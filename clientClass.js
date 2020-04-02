'use strict'
const utils = require('./utils');
class Client{
    constructor(settings){
        this.settings = settings;
    }
    createClient(testMessage, index, callback){
        if (testMessage.include) {
            let message = new Object();
            message.complete = false;
            message.index = index;
            message.testCaseName = testMessage.testCaseName;
            message.testCaseDescription = testMessage.testCaseDescription;
            message.expectedResult = testMessage.expectedResult;
            message.jsonCmds = new Object();
            message.jsonCmds.apiKey = testMessage.jsonCmds.apiKey;
            message.jsonCmds.appVersion = testMessage.jsonCmds.appVersion;
            message.jsonCmds.message = testMessage.jsonCmds.message;
            message.jsonCmds.method = testMessage.jsonCmds.method;
            message.jsonCmds.protocolVersion = testMessage.jsonCmds.protocolVersion;
            message.jsonCmds.status = testMessage.jsonCmds.status;
            message.jsonCmds.payload = new Object();
            message.jsonCmds.payload.build = testMessage.jsonCmds.payload.build;
            message.jsonCmds.payload.certHashes = testMessage.jsonCmds.payload.certHashes;
            message.jsonCmds.payload.client = testMessage.jsonCmds.payload.client;
            message.jsonCmds.payload.currentMode = testMessage.jsonCmds.payload.currentMode;
            message.jsonCmds.payload.fqdn = testMessage.jsonCmds.payload.fqdn;
            message.jsonCmds.payload.password = utils.generateOSAdminPassword();
            message.jsonCmds.payload.profile = testMessage.jsonCmds.payload.profile;
            message.jsonCmds.payload.sku = testMessage.jsonCmds.payload.sku;
            message.jsonCmds.payload.username = testMessage.jsonCmds.payload.username;
            if (testMessage.jsonCmds.payload.uuid) { message.jsonCmds.payload.uuid = utils.generateUuid(); } else { message.jsonCmds.payload.uuid = testMessage.jsonCmds.payload.uuid; }
            message.jsonCmds.payload.ver = testMessage.jsonCmds.payload.ver;
            message.wsmanCmds = new Object();
            message.wsmanCmds.hostBasedSetupServiceResponse = new Object();
            message.wsmanCmds.hostBasedSetupServiceResponse.allowedControlModes = testMessage.wsmanCmds.hostBasedSetupServiceResponse.allowedControlModes;
            message.wsmanCmds.hostBasedSetupServiceResponse.certChainStatus = testMessage.wsmanCmds.hostBasedSetupServiceResponse.certChainStatus;
            message.wsmanCmds.hostBasedSetupServiceResponse.configurationNonce = utils.generateNonce(20);
            message.wsmanCmds.hostBasedSetupServiceResponse.currentControlMode = testMessage.wsmanCmds.hostBasedSetupServiceResponse.currentControlMode;
            message.wsmanCmds.hostBasedSetupServiceResponse.messageId = 0;
            message.wsmanCmds.hostBasedSetupServiceResponse.digestRealm = null;
            message.wsmanCmds.certInjectionResponse = new Object();
            message.wsmanCmds.certInjectionResponse.returnValue = testMessage.wsmanCmds.certInjectionResponse.returnValue;
            message.wsmanCmds.adminSetupResponse = new Object();
            message.wsmanCmds.adminSetupResponse.returnValue = testMessage.wsmanCmds.adminSetupResponse.returnValue;
            message.wsmanCmds.setupResponse = new Object();
            message.wsmanCmds.setupResponse.returnValue = testMessage.wsmanCmds.setupResponse.returnValue;
            callback(utils.getUUID((message.jsonCmds.payload.uuid ? message.jsonCmds.payload.uuid : utils.generateUuid())), message);
        }
    }
}
module.exports = Client;