const ethers = require('ethers');

const getEvents = require('../controllers/eventLogs');

const parseEvent = async (
  startBlock,
  endBlock,
  abi,
  config,
  parse,
  test = false
) => {
  // 1. format functionSignatureHashes for db query
  const eventSignatureHash = config.events.map(
    (e) => `\\${e.signatureHash.slice(1)}`
  );

  // 2. read events from db
  const events = await getEvents(
    startBlock,
    endBlock,
    eventSignatureHash,
    config,
    test
  );

  // 3. instantiate abi interface
  const interface = new ethers.Interface(abi);
  for (const e of config.events) {
    config[e.signatureHash] = e.name;
  }

  // 4. parse event data
  const parsedEvents = events.map((event) => {
    const data = `0x${event.data}`;
    const topics = [event.topic_0, event.topic_1, event.topic_2, event.topic_3]
      .filter(Boolean)
      .map((t) => `0x${t}`);

    const name = config[topics[0]];

    const parsedEvent = parse(data, topics, interface, name, event);

    // keeping a bunch of fields from event_logs
    const {
      topic_1,
      topic_2,
      topic_3,
      data: dataEncoded,
      price,
      tx_data,
      ...rest
    } = event;

    return { ...rest, ...parsedEvent, exchangeName: config.exchangeName };
  });

  return parsedEvents.filter((event) => event.collection);
};

module.exports = parseEvent;
