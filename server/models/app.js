'use strict';
const eventLogger = require('../../lib/EventLogger').eventLogger;

module.exports = (sequelize, DataTypes) => {

  const App = sequelize.define('App', {
    title: DataTypes.STRING,
    path: DataTypes.STRING,
    filename: DataTypes.STRING,
    ipAddress: DataTypes.STRING,
    dropletName: DataTypes.STRING,
    network: DataTypes.STRING,
    replicas: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
  }, {});

  App.associate = function(models) {
    // associations can be defined here
  };

  App.prototype.emitEvent = function(message) {
    console.log(message);
    eventLogger.emit(`message-${this.id}`, message + '\n');
  };

  App.prototype.emitStdout = function(data) {
    const message = JSON.parse(data);
    if (message.stream) {
      eventLogger.emit(`message-${this.id}`, message.stream);
    }
  };

  return App;
};