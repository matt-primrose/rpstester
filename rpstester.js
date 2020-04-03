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

/** 
* @description A scale tester for RPS.
* @author Matt Primrose
* @version v0.1.1
*/

'use strict';
const testManager = require('./testManager');
const rpsTesterVersion = '0.1.1';
const settings = new Object();

// Execute based on incoming arguments
function run(argv) {
    // Validate command line parameters
    let args = parseArguments(argv);
    if ((typeof args.url) == 'string') { settings.url = args.url; }
    if ((typeof args.num) == 'string') { settings.num = parseInt(args.num); }
    if ((typeof args.verbose) == 'string') { settings.verbose = parseInt(args.verbose); } else { settings.verbose = 0; }
    if ((typeof args.batchsize) == 'string') { settings.batchSize = parseInt(args.batchsize); }
    if ((args.url == undefined) || (args.num == undefined)){
        consoleHelp();
    }
    if ((typeof settings.url == 'string') && (typeof settings.num == 'number')){
        let testMgr = new testManager(settings);
        testMgr.startTest();
    }
}

// Cleanly exit the application and provide an exit code to STDOUT
function exit(status) { if (status == null) { status = 0; } try { process.exit(status); } catch (e) { } }

// Parse command line arguments when running out of Node.  TODO: Update this to take command line arguments when running out of NPM Start Script
function parseArguments(argv) {let r = {};for (let i in argv) {i = parseInt(i);if (argv[i].startsWith('--') == true) {let key = argv[i].substring(2).toLowerCase();let val = true;if (((i + 1) < argv.length) && (argv[i + 1].startsWith('--') == false)) {val = argv[i + 1];}r[key] = val;}}return r;}

// Present instructions to user if missing required parameters aren't provided at the command line
function consoleHelp(){
    oamtct();
    console.log('RPS Scale Tester ver. ' + rpsTesterVersion);
    console.log('No action specified, use rpstester like this:\r\n');
    console.log('  rpstester --url [wss://server] --num [number] --verbose [number] --batchsize [number]\r\n');
    console.log('  URL        - Server fqdn or IP:port of the RPS.');
    console.log('  NUM        - Number of connections to emulate.');
    console.log('  VERBOSE    - (optional) Verbocity level: 0 = Status only, 1 = Critical messages, 2 = All messages.  Default is 0.');
    console.log('  BATCHSIZE  - (optional) Number of simultaneous connections to the server.  Default is 500.');
    exit(1); return;
}

function oamtct(){
    console.log('Open AMT Cloud Toolkit - Remote Provisioning Software Scale Testing Tool.');
}

// Figure out if any arguments were provided, otherwise show help
if (process.argv.length > 2) {
    run(process.argv);
} else {
    consoleHelp();
    exit(2); return;
}