const { getCollectionSales } = require('../controllers/collections');

module.exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const collectionId = event.pathParameters.collectionId;
  return await getCollectionSales(collectionId);
};
