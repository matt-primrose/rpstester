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
const crypto = require('crypto');
const uuidv4 = require('uuid').v4;
const Utils = new Object();

// Creates a nonce for a given length
Utils.generateNonce = function(length){
    let nonce = crypto.randomBytes(length).toString('hex'); 
    return nonce;
}

// Creates a UUID
Utils.generateUuid = function(){
    let buf = new Array();
    let amtUuid = uuidv4(null, buf);
    return amtUuid;
}

// Parses a UUID from a Byte Array
Utils.getUUID = function(uuid) {
    if (uuid == false) { return false; }
    uuid = Buffer.from(uuid);
    let guid = [
      zeroLeftPad(uuid.readUInt32LE(0).toString(16), 8),
      zeroLeftPad(uuid.readUInt16LE(4).toString(16), 4),
      zeroLeftPad(uuid.readUInt16LE(6).toString(16), 4),
      zeroLeftPad(uuid.readUInt16BE(8).toString(16), 4),
      zeroLeftPad(uuid.slice(10).toString("hex").toLowerCase(), 12)].join("-");

    return guid;
}

// Returns the formatted MessageID for WSMAN messages
Utils.generateMessageId = function(previousMessageId){
    let messageId = "00000000-8086-8086-8086-00000000000" + previousMessageId.toString()
    return messageId;
}

// Creates the Digest Realm needed for AMT Activation
Utils.generateDigestRealm = function(){
    let digestRealm = null;
    digestRealm = 'Digest:'+getRandomHex(4)+'0000000000000000000000000000';
    return digestRealm;
}

// Creates a random OSAdmin password
Utils.generateOSAdminPassword = function(){
    let length = 32;
    let password = '';
    let validChars = "abcdefghijklmnopqrstuvwxyz";
    let validNums = "0123456789";
    let validSpec = "!@#$%^&*()_-+=?.>,<";
    let numLen = Math.floor(Math.random() * length/3) + 1;
    let specLen = Math.floor(Math.random() * length/3) + 1;
    let charLen = length-numLen-specLen;
    for (let x = 0; x < charLen; x++){
        let upper = Math.random() >= 0.5;
        if (upper == true){ password += validChars.charAt(Math.floor(Math.random() * validChars.length)).toUpperCase(); }
        else { password += validChars.charAt(Math.floor(Math.random() * validChars.length)); }
    }
    for (let x = 0; x < specLen; x++){
        password += validSpec.charAt(Math.floor(Math.random() * validSpec.length));
    }
    for (let x = 0; x < numLen; x++){
        password += validNums.charAt(Math.floor(Math.random() * validNums.length));
        password = password.split('').sort(function(){ return 0.5 - Math.random() }).join('');
    }
    return password;
}

module.exports = Utils;

// Helper function for getUUID
function zeroLeftPad(str, len) {
    if (len == null && typeof len != "number") {
        return null;
    }
    if (str == null) str = ""; // If null, this is to generate zero leftpad string
    let zlp = "";
    for (var i = 0; i < len - str.length; i++) {
        zlp += "0";
    }
    return zlp + str;
}

// Creates a random hex value of a given length
function getRandomHex(length){
    let num;
    for (var x = 0; x < length; x++){
        if (x === 0) { num = Math.floor(Math.random() * 15).toString(16); }
        else { num += Math.floor(Math.random() * 15).toString(16); }
    }
    return num;
}