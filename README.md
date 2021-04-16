# rpstester
A scale tester for testing RPS at scale

RPSTester emulates the client side communication between RCS and RPS.  

Test Case Configuration File Details:
```
{
    "file-description":"list of test messages used to test RCS",        // JSON File Description 
    "version":2.0,                                                      // Version of the document
    "testCases":[                                                       // Array to hold the test cases
        {
            "testCaseName":"TC001",                                     // Test Case Name - Must be unique (Used by RPSTester)
            "testCaseDescription": "Activate in Admin Control Mode",    // Test Case Description - Helps tester know what each test case is testing (not used by RPSTester)
            "include": true,                                            // Used by RPS Tester to know if test case should be included or not.  Valid values: true, false
            "expectedResult":"pass",                                    // Used by RPS Tester to know if test is possitive or negative test case.  Valid values: pass, fail
            "jsonCmds": {                                               // jsonCmds object holds the information that PPC initially sends to RPS
                "apiKey": "key",                                        // Currently not used by RPS.  No impact by changing
                "appVersion": "1.0.0",                                  // Currently not used by RPS.  No impact by changing
                "message": "all's good!",                               // Currently not used by RPS.  No impact by changing
                "method":"activation",                                  // Method request to RPS.  Valid values: activation, deactivation
                "payload":{                                             // Payload is the AMT information sent up to RPS by PPC
                    "build": "3003",                                    // AMT Build number
                    "certHashes":[                                      // Array of Trusted Root Certificate Hashes.
                        "E7685634EFACF69ACE939A6B255B7B4FABEF42935B50A265ACB5CB6027E44E70",
                        "EB04CF5EB1F39AFA762F2BB120F296CBA520C1B97DB1589565B81CB9A17B7244",
                        "C3846BF24B9E93CA64274C0EC67C1ECC5E024FFCACD2D74019350E81FE546AE4",
                        "D7A7A0FB5D7E2731D771E9484EBCDEF71D5F0C3E0A2948782BC83EE0EA699EF4",
                        "1465FA205397B876FAA6F0A9958E5590E40FCC7FAA4FB7C2C8677521FB5FB658",
                        "83CE3C1229688A593D485F81973C0F9195431EDA37CC5E36430E79C7A888638B",
                        "A4B6B3996FC2F306B3FD8681BD63413D8C5009CC4FA329C2CCF0E2FA1B140305",
                        "9ACFAB7E43C8D880D06B262A94DEEEE4B4659989C3D0CAF19BAF6405E41AB7DF",
                        "A53125188D2110AA964B02C7B7C6DA3203170894E5FB71FFFB6667D5E6810A36",
                        "16AF57A9F676B0AB126095AA5EBADEF22AB31119D644AC95CD4B93DBF3F26AEB",
                        "960ADF0063E96356750C2965DD0A0867DA0B9CBD6E77714AEAFB2349AB393DA3",
                        "68AD50909B04363C605EF13581A939FF2C96372E3F12325B0A6861E1D59F6603",
                        "6DC47172E01CBCB0BF62580D895FE2B8AC9AD4F873801E0C10B9C837D21EB177",
                        "73C176434F1BC6D5ADF45B0E76E727287C8DE57616C1E6E6141A2B2CBC7D8E4C",
                        "2399561127A57125DE8CEFEA610DDF2FA078B5C8067F4E828290BFB860E84B3C",
                        "45140B3247EB9CC8C5B4F0D7B53091F73292089E6E5A63E2749DD3ACA9198EDA",
                        "43DF5774B03E7FEF5FE40D931A7BEDF1BB2E6B42738C4E6D3841103D3AA7F339",
                        "2CE1CB0BF9D2F9E102993FBE215152C3B2DD0CABDE1C68E5319B839154DBB7F5",
                        "70A73F7F376B60074248904534B11482D5BF0E698ECC498DF52577EBF2E93B9A"
                    ],
                    "client":"PPC",                                     // Currently not used by RPS.  No impact by changing
                    "currentMode":0,                                    // Used to verify the current provisioning state of AMT.  Valid values: 0 = pre-provisioning,  1 = in-provisioning, 2 = post-provisioning
                    "fqdn":"vprodemo.com",                              // Used to match against provisioning certificate domain suffix
                    "password":null,                                    // RPS Tester will auto generate this value.  Changing this has no impact
                    "profile":"PROFILE1",                               // Specifies the RPS profile to use for the test case
                    "sku":"16392",                                      // Currently not used by RPS.  No impact by changing
                    "username":"$$OsAdmin",                             // Used to activate AMT, however, no impact by changing this value
                    "uuid":true,                                        // Specifies if RPS Tester should generate an AMT GUID or not.  Valid values: true, {"random":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}
                    "ver":"11.8.55"                                     // Specifies the version of AMT
                },
                "protocolVersion": "2.0.0",                             // Specifies the protocol version of communication between RPS and PPC.  Currently not used.  No impact by changing
                "status": "ok"                                          // Indicates that the JSON message being sent up is OK.  Valid values: ok error
            },
            "wsmanCmds": {                                              // Object containing list of WSMAN command options
                "hostBasedSetupServiceResponse":{                       // Covers WSMAN responses for HostBasedSetupService calls
                    "allowedControlModes":[2,1],                        // Specifies allowedControlModes.  Valid values: 2 = ACM, 1 = CCM.  Currently need 2 items in the array for RPS Tester to function
                    "certChainStatus":0,                                // Currently not used by RPS.  No impact by changing
                    "configurationNonce":null,                          // RPS Tester will auto generate this value.  Changing this has no impact
                    "currentControlMode":0                              // Currently not used by RPS.  Valid values: 0 = Not Configured, 1 = Client Control Mode, 2 = Admin Control Mode
                },
                "certInjectionResponse":{                               // Covers WSMAN responses for CertInjection calls
                    "returnValue":0                                     // Valid values: 0 = Success, non-0 = Failure
                },
                "adminSetupResponse":{                                  // Covers WSMAN responses for AdminSetup calls
                    "returnValue":0                                     // Valid values: 0 = Success, non-0 = Failure
                },
                "setupResponse":{                                       // Covers WSMAN responses for Setup calls
                    "returnValue":0                                     // Valid values: 0 = Success, non-0 = Failure
                },
                "setupAndConfigurationServiceResponse":{                // Covers WSMAN responses for SetupAndConfigurationService calls
                    "provisioningMode":1,                               // Valid values: 1 = ACM, 2 = Reserved, 3 = CCM, 4 = Reserved
                    "provisioningState":2                               // Valid values: 0 = Pre-Provisioning, 1 = In-Provisioning, 2 = Post-Provisioning
                },
                "deactivateResponse":{                                  // Covers WSMAN response for Unprovision call
                    "returnValue":0                                     // Valid values: 0 = Success, non-0 = Failure
                }
            }
        }
    ],
    "wsmanTestMessages": {                                              // This information handles WSMAN Header messages.  Do NOT change these values.
        "header":{
            "status":{
                "ok":"HTTP/1.1 200 OK",
                "unauthorized":"HTTP/1.1 401 Unauthorized"
            },
            "digestAuth":{
                "auth":"WWW-Authenticate: ",
                "nonce":"nonce=",
                "stale":"stale=",
                "qop":"qop="
            },
            "contentType":[
                "text/html",
                "application/soap+xml; charset=UTF-8"
            ],
            "connection":"close",
            "server":"AMT",
            "xFrameOptions":"DENY",
            "encoding":"chunked"
        }
    }
}
```

## Deactivation Test Cases
For deactivation test cases, RPS is currently unable to deactivate devices that it didn't originally activate.  In developer mode, RPS saves the configuration information in the MPS credentials.json file.  In production mode, RPS saves the configuration information in Vault.  For testing deactivation, a dummy GUID and credentials will need to be added to one of these places depending on which mode RPS is operating.  The following entry needs to be added for the deactivation test cases to work: 
```
"00000000-0000-0040-8000-000000000000": {
    "name": "00000000-0000-0040-8000-000000000000",
    "mpsuser": "user",
    "mpspass": "pass",
    "amtuser": "user",
    "amtpass": "pass"
  }
```
Note: the mpsuser, mpspass, amtuser, and amtpass values are not used or validated for testing purposes

Currently deactivate only works if run once.  Consecutive executions of deactivate test cases will not be counted and will cause the "Successful results" to not equal "Expected successul" and will be marked red.  This is due to the same GUID being used by all deactivation test cases.  Will look into fixing this in the future.
