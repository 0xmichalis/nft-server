const { stripZerosLeft } = require('ethers');

const abi = require('./abi.json');
const config = require('./config.json');
const { nftTransferEvents } = require('../../utils/params');
const getHistoricalTokenPrice = require('../../utils/price');

const parse = async (decodedData, event, events) => {
  const transfers = events.filter(
    (e) => e.transaction_hash === event.transaction_hash
  );

  // erc20 transfers
  const transfersERC20 = transfers.filter(
    (e) =>
      e.topic_0 === nftTransferEvents['erc721_Transfer'] && e.topic_3 === null
  );
  const transfersERC20LogIndices = transfersERC20.map((i) => i.log_index);

  // erc721/erc1155 transfers
  const transfersNFT = transfers.filter(
    (e) => !transfersERC20LogIndices.includes(e.log_index)
  );

  // find the first transfer event which has the from address in either topic_1 - topic_3
  // so we catch both cases of erc721 transfer and erc1155 TransferSingle
  const transferEventNFT = transfersNFT.find(
    (tf) =>
      tf.topic_1.includes(event.from_address) ||
      tf.topic_2.includes(event.from_address) ||
      tf.topic_3.includes(event.from_address)
  );

  if (!transferEventNFT) return {};

  let tokenId;
  if (transferEventNFT.topic_0 === nftTransferEvents['erc721_Transfer']) {
    tokenId = BigInt(`0x${transferEventNFT.topic_3}`);
  } else if (
    transferEventNFT.topic_0 === nftTransferEvents['erc1155_TransferSingle']
  ) {
    tokenId = BigInt(`0x${transferEventNFT.data.slice(0, 64)}`);
  }

  const { maker, taker, price } = decodedData;

  let paymentToken;
  let salePrice;
  let ethSalePrice;
  let usdSalePrice;

  const nullAddress = '0x0000000000000000000000000000000000000000';
  if (transfersERC20.length) {
    const x = transfersERC20.find((t) => {
      const d = stripZerosLeft(`0x${t.data}`);
      return BigInt(d === '0x' ? '0x0' : d) === price;
    });

    if (x === undefined) return {};
    if (x.contract_address === 'c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
      salePrice = ethSalePrice = price.toString() / 1e18;
      paymentToken = x?.contract_address ?? nullAddress;
      usdSalePrice = salePrice * event.price;
    } else {
      paymentToken = x.contract_address;

      try {
        ({ salePrice, ethSalePrice, usdSalePrice, _ } =
          await getHistoricalTokenPrice(event, `0x${paymentToken}`, price));
      } catch (err) {
        console.log('api price call failed');
      }
    }
  } else {
    salePrice = ethSalePrice = price.toString() / 1e18;
    paymentToken = nullAddress;
    usdSalePrice = salePrice * event.price;
  }

  // bundle trades:
  // if to_address was wyvern exchange contracts and if more than 1 nft was transferred then
  // it was a bundle trade, for which we scale the total sale price from the ordersMatched event
  // by the nb of nft-transfers (= the individual sales)
  const numberOfNftsSold = transfersNFT.length;
  if (
    config.contracts.includes(`0x${event.to_address}`) &&
    numberOfNftsSold > 1
  ) {
    return transfersNFT.map((t) => {
      let tokenId;
      if (t.topic_0 === nftTransferEvents['erc721_Transfer']) {
        tokenId = BigInt(`0x${t.topic_3}`);
      } else if (t.topic_0 === nftTransferEvents['erc1155_TransferSingle']) {
        tokenId = BigInt(`0x${t.data.slice(0, 64)}`);
      }

      return {
        collection: t.contract_address,
        tokenId,
        amount: 1,
        salePrice: salePrice / numberOfNftsSold,
        ethSalePrice: ethSalePrice / numberOfNftsSold,
        usdSalePrice: usdSalePrice / numberOfNftsSold,
        paymentToken,
        seller: maker,
        buyer: taker,
      };
    });
  }

  return {
    collection: transferEventNFT.contract_address,
    tokenId,
    amount: 1,
    salePrice,
    ethSalePrice,
    usdSalePrice,
    paymentToken,
    seller: maker,
    buyer: taker,
  };
};

module.exports = {
  abi,
  config,
  parse,
};
