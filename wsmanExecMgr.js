/*
Copyright 2018-2020 Intel Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
'use strict'
const wsmanMsgAssy = require('./wsmanMsgAssy');
const utils = require('./utils');
// Arrays for holding the WSMAN ResourceURI and Action strings for determining the current request from the server
const wsmanResourceUri = ['http://intel.com/wbem/wscim/1/amt-schema/1/AMT_GeneralSettings','http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService','http://intel.com/wbem/wscim/1/amt-schema/1/AMT_SetupAndConfigurationService'];
const wsmanAction = ['http://schemas.xmlsoap.org/ws/2004/09/transfer/Get','http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/AddNextCertInChain','http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/AdminSetup','http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/Setup', 'http://intel.com/wbem/wscim/1/amt-schema/1/AMT_SetupAndConfigurationService/Unprovision'];

/**
 * @description WSMAN Execution Manager Class
 */
class WsmanExecMgr {
    /**
     * @description Constructor for WSMAN Execution Manager Class
     * @param {Object} settings 
     * @param {Object} wsmanHeader 
     */
    constructor(settings, wsmanHeader) {
        this.settings = settings;
        this.wsmanHeader = wsmanHeader;
    }
    /**
     * @description Parses the WSMAN object and determines where in the activation flow the emulated client is currently
     * @param {Object} wsmanObj 
     * @param {Boolean} authHeader 
     */
    determineWsmanStep(wsmanObj, authHeader){
        let stepVal, resourceVal, actionVal;
        if (authHeader == false){ stepVal = 0; }
        else {
            for (var x = 0; x < wsmanResourceUri.length; x++){
                if (this.settings.verbose == 2) { console.log("wsmanResourceURI: " + wsmanResourceUri[x] + "\n\rwsmanObj.ResourceURI: " + wsmanObj.Header.ResourceURI); }
                if (wsmanResourceUri[x] == wsmanObj.Header.ResourceURI){ resourceVal = x; break; }
            }
            for (var y = 0; y < wsmanAction.length; y++){
                if (this.settings.verbose == 2) { console.log("wsmanAction: " + wsmanAction[y] + "\n\rwsmanObj.Action: " + wsmanObj.Header.Action); }
                if (wsmanAction[y] == wsmanObj.Header.Action) { actionVal = y; break; }
            }
            stepVal = getStepValue(resourceVal, actionVal);
            if (this.settings.verbose == 1) { console.log("Step Value: " + stepVal); }
        }
        return stepVal;
    }
    /**
     * @description Manages each the response at each WSMAN step
     * @param {Number} stage 
     * @param {Object} client 
     */
    executeWsmanStage(stage, client){
        client.step = stage;
        let returnValue = null;
        let wsmanMessage, header, combinedMessage, payloadB64, response;
        if (this.settings.verbose == 1) { console.log("Step " + client.step + " - Start"); }
        client.wsmanCmds.hostBasedSetupServiceResponse.messageId++;
        if (this.settings.verbose == 1) { console.log("Message ID: " + utils.generateMessageId(client.wsmanCmds.hostBasedSetupServiceResponse.messageId)); }
        if (client.wsmanCmds.hostBasedSetupServiceResponse.digestRealm == null) client.wsmanCmds.hostBasedSetupServiceResponse.digestRealm = utils.generateDigestRealm();
        if (this.settings.verbose == 1) { console.log("Digest Realm: " + client.wsmanCmds.hostBasedSetupServiceResponse.digestRealm); }
        if (client.step == 3) { returnValue = client.wsmanCmds.certInjectionResponse.returnValue; } 
        if (client.step == 4) { returnValue = client.wsmanCmds.adminSetupResponse.returnValue; }
        if (client.step == 5) { returnValue = client.wsmanCmds.setupResponse.returnValue; }
        if (client.step == 7) { returnValue = client.wsmanCmds.deactivateResponse.returnValue; }
        if (this.settings.verbose == 1) { console.log("Return Value: " + returnValue); }
        let msgAssy = new wsmanMsgAssy(this.settings);
        wsmanMessage = msgAssy.createWsmanMessage(client.step, utils.generateMessageId(client.wsmanCmds.hostBasedSetupServiceResponse.messageId), client.wsmanCmds.hostBasedSetupServiceResponse.digestRealm, client.wsmanCmds.hostBasedSetupServiceResponse.currentControlMode, client.wsmanCmds.hostBasedSetupServiceResponse.allowedControlModes, client.wsmanCmds.hostBasedSetupServiceResponse.certChainStatus, client.wsmanCmds.hostBasedSetupServiceResponse.configurationNonce, returnValue);
        let headerInfo = new Object();
        if (client.step == 0){
            headerInfo.status = this.wsmanHeader.header.status.unauthorized;
            headerInfo.digestAuth = this.wsmanHeader.header.digestAuth;
            headerInfo.contentType = this.wsmanHeader.header.contentType[0];
            headerInfo.connection = this.wsmanHeader.header.connection;
            headerInfo.xFrameOptions = null;
            headerInfo.encoding = null;
        } else {
            headerInfo.status = this.wsmanHeader.header.status.ok;
            headerInfo.digestAuth = null;
            headerInfo.contentType = this.wsmanHeader.header.contentType[1];
            headerInfo.connection = null;
            headerInfo.xFrameOptions = this.wsmanHeader.header.xFrameOptions;
            headerInfo.encoding = this.wsmanHeader.header.encoding;
        }
        headerInfo.server = this.wsmanHeader.header.server;
        header = msgAssy.createWsmanHeader(headerInfo.status, headerInfo.digestAuth, utils.generateDigestRealm(), utils.generateNonce(16), headerInfo.contentType, headerInfo.server, wsmanMessage.length, headerInfo.connection, headerInfo.xFrameOptions, headerInfo.encoding);
        combinedMessage = header + wsmanMessage.wsman;
        if (this.settings.verbose == 2) { console.log("---SENDING MESSAGE TO RPS---"); }
        if (this.settings.verbose == 2) { console.log("WSMan Payload: \n\r" + combinedMessage); }
        payloadB64 = Buffer.from(combinedMessage).toString('base64');
        response = {"apiKey": client.jsonCmds.apiKey,"appVersion":client.jsonCmds.appVersion,"message":client.jsonCmds.message,"method":"response","payload":payloadB64,"protocolVersion":client.jsonCmds.protocolVersion,"status":client.jsonCmds.status};
        if (this.settings.verbose == 2) { console.log("Message: \n\r" + JSON.stringify(response)); }
        client.tunnel.send(JSON.stringify(response));
        if (this.settings.verbose == 2) { console.log("---MESSAGE SENT---"); }
        if (this.settings.verbose == 2) { console.log("Step " + stage + " - End"); }
    }
}

module.exports = WsmanExecMgr;

function getStepValue(rVal, aVal){
    let sVal = null;
    if (rVal == 0 && aVal == 0) { sVal = 1; }
    if (rVal == 1 && aVal == 0) { sVal = 2; }
    if (rVal == 1 && aVal == 1) { sVal = 3; }
    if (rVal == 1 && aVal == 2) { sVal = 4; }
    if (rVal == 1 && aVal == 3) { sVal = 5; }
    if (rVal == 2 && aVal == 0) { sVal = 6; }
    if (rVal == 2 && aVal == 4) { sVal = 7; }
    return sVal;
}