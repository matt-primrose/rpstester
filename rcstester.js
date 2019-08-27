/*
Copyright 2018-2019 Intel Corporation

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
* @description A scale tester for RCS.
* @author Matt Primrose
* @version v0.0.1
*/

'use strict';
const fs = require('fs');
const rcsTesterVersion = '0.0.1';
// Execute based on incoming arguments
function run(argv) {
    let args = parseArguments(argv);
    let settings = new Object();
    if ((typeof args.url) == 'string') { settings.url = args.url ;}
    if ((typeof args.num) == 'string') { settings.num = parseInt(args.num); }
    if ((args.url == undefined) || (args.num == undefined)){
        consoleHelp();
    }
    if ((typeof settings.url == 'string') && (typeof settings.num == 'number')){
        startTest();
    }
}
function exit(status) { if (status == null) { status = 0; } try { process.exit(status); } catch (e) { } }
function parseArguments(argv) {let r = {};for (let i in argv) {i = parseInt(i);if (argv[i].startsWith('--') == true) {let key = argv[i].substring(2).toLowerCase();let val = true;if (((i + 1) < argv.length) && (argv[i + 1].startsWith('--') == false)) {val = argv[i + 1];}r[key] = val;}}return r;}
function consoleHelp(){
    console.log('RCS Scale Tester ver. ' + rcsTesterVersion);
    console.log('No action specified, use rcstester like this:\r\n');
    console.log('  rcstester --url [wss://server] --num [number]\r\n');
    console.log('  URL      - Server fqdn or IP:port of the RCS.');
    console.log('  NUM      - Number of connections to emulate.');
    exit(1); return;
}

function startTest(){
    let testfile = JSON.parse(fs.readFileSync(__dirname + '/testmessages.json', 'utf8'));
    
}

// Figure out if any arguments were provided, otherwise show help
if (process.argv.length > 2) {
    run(process.argv);
} else {
    consoleHelp();
    exit(2); return;
}