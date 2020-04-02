'use strict'
class WsmanMessageAssember{
    constructor(settings){
        this.settings = settings;
    }
    // Generates the WSMAN header
    createWsmanHeader(status, auth, digestRealm, nonce, contentType, server, contentLength, connection, xFrame, encoding){
        let header = null;
        if (status !== null) { header = status + "\r\n";}
        if (auth !== null && digestRealm !== null && nonce !== null) { header  += auth.auth + 'Digest realm="' + digestRealm + '", ' + auth.nonce + '"' + nonce + '", ' + auth.stale + '"false", ' + auth.qop + '"auth"\r\n'; }
        if (contentType !== null) { header  += 'Content-Type: ' +contentType + '\r\n'; }
        if (server !== null) { header  += 'Server: ' + server + '\r\n'; }
        if (contentLength !== null) { header  += 'Content-Length: ' + contentLength + '\r\n'; }
        if (connection !== null) { header  += 'Connection: ' + connection + '\r\n\r\n'; }
        if (xFrame !== null) { header  += 'X-Frame-Options: ' + xFrame + '\r\n'; }
        if (encoding !== null) { header  += 'Transfer-Encoding: ' + encoding + '\r\n\r\n'; }
        return header;
    }

    // Generates the WSMAN body
    createWsmanMessage(messageType, messageId, digestRealm, currentControlMode, allowedControlModes, certChainStatus, configurationNonce, returnValue){
        let message = {}
        switch (messageType){
            case 0:
                message.wsman = setMessageArgs('Unauthorized');
                break;
            case 1:
                message.wsman = setMessageArgs('GeneralSettingsResponse', messageId, digestRealm);
                break;
            case 2:
                message.wsman = setMessageArgs('HostBasedSetupServiceResponse', messageId, allowedControlModes[0], allowedControlModes[1], certChainStatus, configurationNonce, currentControlMode);
                break;
            case 3:
                message.wsman = setMessageArgs('CertinjectionResponse', messageId, returnValue);
                break;
            case 4:
                message.wsman = setMessageArgs('AdminSetupResponse', messageId, returnValue);
                break;
            case 5:
                message.wsman = setMessageArgs('SetupResponse', messageId, returnValue);
                break;
            default:
                break;
        }
        message.length = message.wsman.length;
        return message;
    }
}

module.exports = WsmanMessageAssember;

function setMessageArgs(message, arg1, arg2, arg3, arg4, arg5, arg6){
    const WsManMessages = {
        "Unauthorized":`<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" >\n<html><head><link rel=stylesheet href=/styles.css>\n<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n<title>Intel&reg; Active Management Technology</title></head>\n<body>\n<table class=header>\n<tr><td valign=top nowrap>\n<p class=top1>Intel<font class=r><sup>&reg;</sup></font> Active Management Technology\n<td valign="top"><img src="logo.gif" align="right" alt="Intel">\n</table>\n<br />\n<h2 class=warn>Log on failed. Incorrect user name or password, or user account temporarily locked.</h2>\n\n<p>\n<form METHOD="GET" action="index.htm"><h2><input type=submit value="Try again">\n</h2></form>\n<p>\n\n</body>\n</html>\n`,
        "GeneralSettingsResponse":'0513\r\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><a:Envelope xmlns:a=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:b=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:c=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:d=\"http://schemas.xmlsoap.org/ws/2005/02/trust\" xmlns:e=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:f=\"http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd\" xmlns:g=\"http://intel.com/wbem/wscim/1/amt-schema/1/AMT_GeneralSettings\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>1</b:RelatesTo><b:Action a:mustUnderstand=\"true\">http://schemas.xmlsoap.org/ws/2004/09/transfer/GetResponse</b:Action><b:MessageID>uuid:'+arg1+'</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/amt-schema/1/AMT_GeneralSettings</c:ResourceURI></a:Header><a:Body><g:AMT_GeneralSettings><g:AMTNetworkEnabled>1</g:AMTNetworkEnabled><g:DDNSPeriodicUpdateInterval>1440</g:DDNSPeriodicUpdateInterval><g:DDNSTTL>900</g:DDNSTTL><g:DDNSUpdateByDHCPServerEnabled>true</g:DDNSUpdateByDHCPServerEnabled><g:DDNSUpdateEnabled>false</g:DDNSUpdateEnabled><g:DHCPv6ConfigurationTimeout>0</g:DHCPv6ConfigurationTimeout><g:DigestRealm>'+arg2+'</g:DigestRealm><g:DomainName></g:DomainName><g:ElementName>Intel(r) AMT: General Settings</g:ElementName><g:HostName></g:HostName><g:HostOSFQDN></g:HostOSFQDN><g:IdleWakeTimeout>65535</g:IdleWakeTimeout><g:InstanceID>Intel(r) AMT: General Settings</g:InstanceID><g:NetworkInterfaceEnabled>true</g:NetworkInterfaceEnabled><g:PingResponseEnabled>true</g:PingResponseEnabled><g:PowerSource>0</g:PowerSource><g:PreferredAddressFamily>0</g:PreferredAddressFamily><g:PresenceNotificationInterval>0</g:PresenceNotificationInterval><g:PrivacyLevel>0</g:PrivacyLevel><g:RmcpPingResponseEnabled>true</g:RmcpPingResponseEnabled><g:SharedFQDN>true</g:SharedFQDN><g:WsmanOnlyMode>false</g:WsmanOnlyMode></g:AMT_GeneralSettings></a:Body></a:Envelope>\r\n0\r\n\r\n',
        "HostBasedSetupServiceResponse":'0513\r\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><a:Envelope xmlns:a=\"http://www.w3.org/2003/05/soap-envelope\" xmlns:b=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\" xmlns:c=\"http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd\" xmlns:d=\"http://schemas.xmlsoap.org/ws/2005/02/trust\" xmlns:e=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:f=\"http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd\" xmlns:g=\"http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService\" xmlns:h=\"http://schemas.dmtf.org/wbem/wscim/1/common\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>2</b:RelatesTo><b:Action a:mustUnderstand=\"true\">http://schemas.xmlsoap.org/ws/2004/09/transfer/GetResponse</b:Action><b:MessageID>uuid:'+arg1+'</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService</c:ResourceURI></a:Header><a:Body><g:IPS_HostBasedSetupService><g:AllowedControlModes>'+arg2+'</g:AllowedControlModes><g:AllowedControlModes>'+arg3+'</g:AllowedControlModes><g:CertChainStatus>'+arg4+'</g:CertChainStatus><g:ConfigurationNonce>'+arg5+'</g:ConfigurationNonce><g:CreationClassName>IPS_HostBasedSetupService</g:CreationClassName><g:CurrentControlMode>'+arg6+'</g:CurrentControlMode><g:ElementName>Intel(r) AMT Host Based Setup Service</g:ElementName><g:Name>Intel(r) AMT Host Based Setup Service</g:Name><g:SystemCreationClassName>CIM_ComputerSystem</g:SystemCreationClassName><g:SystemName>Intel(r) AMT</g:SystemName></g:IPS_HostBasedSetupService></a:Body></a:Envelope>\r\n0\r\n\r\n',
        "CertinjectionResponse":'<?xml version="1.0" encoding="UTF-8"?><a:Envelope xmlns:a="http://www.w3.org/2003/05/soap-envelope" xmlns:b="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:c="http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd" xmlns:d="http://schemas.xmlsoap.org/ws/2005/02/trust" xmlns:e="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:f="http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd" xmlns:g="http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>3</b:RelatesTo><b:Action a:mustUnderstand="true">http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/AddNextCertInChainResponse</b:Action><b:MessageID>uuid:'+arg1+'</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService</c:ResourceURI></a:Header><a:Body><g:AddNextCertInChain_OUTPUT><g:ReturnValue>'+arg2+'</g:ReturnValue></g:AddNextCertInChain_OUTPUT></a:Body></a:Envelope>',
        "AdminSetupResponse":'<?xml version="1.0" encoding="UTF-8"?><a:Envelope xmlns:a="http://www.w3.org/2003/05/soap-envelope" xmlns:b="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:c="http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd" xmlns:d="http://schemas.xmlsoap.org/ws/2005/02/trust" xmlns:e="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:f="http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd" xmlns:g="http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>7</b:RelatesTo><b:Action a:mustUnderstand="true">http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/AdminSetupResponse</b:Action><b:MessageID>uuid:'+arg1+'</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService</c:ResourceURI></a:Header><a:Body><g:AdminSetup_OUTPUT><g:ReturnValue>'+arg2+'</g:ReturnValue></g:AdminSetup_OUTPUT></a:Body></a:Envelope>',
        "SetupResponse":'<?xml version="1.0" encoding="UTF-8"?><a:Envelope xmlns:a="http://www.w3.org/2003/05/soap-envelope" xmlns:b="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:c="http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd" xmlns:d="http://schemas.xmlsoap.org/ws/2005/02/trust" xmlns:e="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:f="http://schemas.dmtf.org/wbem/wsman/1/cimbinding.xsd" xmlns:g="http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><a:Header><b:To>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</b:To><b:RelatesTo>7</b:RelatesTo><b:Action a:mustUnderstand="true">http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService/SetupResponse</b:Action><b:MessageID>uuid:'+arg1+'</b:MessageID><c:ResourceURI>http://intel.com/wbem/wscim/1/ips-schema/1/IPS_HostBasedSetupService</c:ResourceURI></a:Header><a:Body><g:Setup_OUTPUT><g:ReturnValue>'+arg2+'</g:ReturnValue></g:Setup_OUTPUT></a:Body></a:Envelope>'
    };
    let response = WsManMessages[message];
    return response;
}