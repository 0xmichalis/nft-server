const { stripZerosLeft } = require('ethers');

const abi = require('./abi.json');
const config = require('./config.json');

const pairFactory = 'a964d6e8d90e5cd12592a8ef2b1735dae9ba0840';

const isBuy = (event) =>
  '0x' + event.topic_0 === config.events.find((e) => e.name === 'Buy').signatureHash;

// TODO: Need to validate the pair originates from the pairFactory
const parse = (decodedData, event, events) => {
  const paymentToken = '0x0000000000000000000000000000000000000000';
  const [ inputAmount, outputAmount ] = decodedData;

  let ethAmountInWei;
  // Assumes NFT decimals is 18
  let nftAmountInWei;
  let seller;
  let buyer;

  if (isBuy(event)) {
    ethAmountInWei = Number(inputAmount);
    nftAmountInWei = Number(outputAmount);
    buyer = event.from_address;
    seller = event.to_address;
  } else {
    ethAmountInWei = Number(outputAmount);
    nftAmountInWei = Number(inputAmount);
    buyer = event.to_address;
    seller = event.from_address;
  }

  const amount = ethAmountInWei / 1e18;
  const ethSalePrice = ethAmountInWei / nftAmountInWei;
  const usdSalePrice = ethSalePrice * event.price;

  // TODO: This is not the collection address but the pair address
  const collection = event.contract_address;

  return {
    collection,
    amount,
    ethSalePrice,
    usdSalePrice,
    paymentToken,
    seller,
    buyer,
  };
};

module.exports = { abi, config, parse };
