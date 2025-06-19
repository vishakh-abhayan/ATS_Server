const logger = require('./src/utils/logger');
const app = require('./src/app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});