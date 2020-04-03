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

/**
 * @description Class to manage test result collection and reporting
 */
class TestResultMgr{
    /**
     * @description TestResultMgr Constructor
     * @param {Object} settings Settings passed in via command line arguments
     * @param {Number} numTestCases Number of test cases being run
     */
    constructor(settings, numTestCases){
        this.settings = settings;
        this.completedTests = 0;
        this.failedTests = 0;
        this.failedTestCaseNames = new Array();
        this.passingTestCaseNames = new Array();
        this.passedTests = 0;
        this.expectedFailedTests = 0;
        this.expectedPassedTests = 0;
        this.numTestPatterns = (settings.num > numTestCases ? numTestCases : settings.num);
        this.requestedTests = settings.num;
    }
    /**
     * @description Records a test case result
     * @param {Boolean} testComplete
     * @param {Boolean} testPass 
     * @param {String} testCaseName 
     * @param {String} expectedResult 
     */
    recordTestResults(testComplete, testPass, testCaseName, expectedResult){
        let expectedResultBool = (expectedResult == "pass" ? true : false);
        let testPassCheck = (expectedResultBool == testPass);
        if (testComplete == true) { this.completedTests++ ;}
        if (testPassCheck == true) {
            if (expectedResult == "pass") { this.passedTests++; } 
            else { this.failedTests++; }
            if (!this.passingTestCaseNames.includes(testCaseName)) { this.passingTestCaseNames.push(testCaseName);}
        } else {
            if (testCaseName !== null) { this.failedTestCaseNames.push(testCaseName); }
            else { this.failedTestCaseNames.push("Missing TC Name"); }
        }
    }
    /**
     * @description Processes the test run results and prints to console
     */
    processTestResults(){
        let red = "\x1b[31m";
        let white = "\x1b[37m";
        let green = "\x1b[32m";
        let result;
        let successfulResults;
        let unsuccessfulResults;
        if (this.expectedPassedTests == this.passedTests) { successfulResults = green;} else { successfulResults = red;}
        if (this.expectedFailedTests == this.failedTests) { unsuccessfulResults = green;} else { unsuccessfulResults = red;}
        if ((successfulResults == green) && (unsuccessfulResults == green)) { result = green; } else { result = red; };
        console.log(result,"Test run complete!");
        console.log(white,'Test Configurations Run:   ' + this.numTestPatterns);
        console.log(white,'Tests requested:           ' + this.requestedTests);
        console.log(white,'Expected successful:       ' + this.expectedPassedTests);
        console.log(successfulResults,'Successful results:        ' + this.passedTests);
        console.log(white,'Expected unsuccessful:     ' + this.expectedFailedTests);
        console.log(unsuccessfulResults,'Unsuccessful results:      ' + this.failedTests);
        console.log(white,'Passing Test Cases:             ' + this.passingTestCaseNames.toString());
        console.log(white,'Failing Test Cases:             ' + this.failedTestCaseNames.toString());
    }
    /**
     * @description Predicts the test results based on test case information
     * @param {Object} clients 
     * @param {Number} iterations 
     */
    predictResults(clients, iterations){
        let y = 0;
        while (y < iterations){
            for (let x in clients){
                if (clients[x].expectedResult == 'pass') { this.expectedPassedTests++; }
                if (clients[x].expectedResult == 'fail') { this.expectedFailedTests++; }
                y++;
                if (y == iterations) { break; }
            }
        }
    }
}

module.exports = TestResultMgr;