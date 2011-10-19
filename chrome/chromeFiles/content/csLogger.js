// *****************************************************************************
// *                            csLogger.js                                    *
// * These are the functions that CookieSwap uses to log info/errors           *
// *                                                                           *
// ************************** Coding Standards *********************************
// *  gMyVariable     - global variable (starts with "g", then mixed case)     *
// *  myVariable      - variables passed into functions                        *
// *  my_variable     - local variable inside of a function                    *
// *  this.myVariable - class attributes/variable (mixed case & always         *
// *                    referenced with "this.")                               *
// *  MyFunction      - functions are always mixed case                        *
// *  MY_CONSTANT     - constants are all caps with underscores                *
// *                                                                           *
// *************************** Revision History ********************************
// *  Name       Date       BugzID  Action                                     *
// *  ---------  ---------  -----   ------                                     *
// *  SteveTine  12Apr2009          Initial Creation                           *
// *                                                                           *
// ************************* BEGIN LICENSE BLOCK *******************************
// * Version: MPL 1.1                                                          *
// *                                                                           *
// *The contents of this file are subject to the Mozilla Public License Version*
// * 1.1 (the "License"); you may not use this file except in compliance with  *
// * the License. You may obtain a copy of the License at                      *
// * http://www.mozilla.org/MPL/                                               *
// *                                                                           *
// * Software distributed under the License is distributed on an "AS IS" basis,*
// * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License  *
// * for the specific language governing rights and limitations under the      *
// * License.                                                                  *
// *                                                                           *
// * The Original Code is the CookieSwap Mozilla/Firefox Extension             *
// *                                                                           *
// * The Initial Developer of the Original Code is                             *
// * Steven Tine.                                                              *
// * Portions created by the Initial Developer are Copyright (C) 2006          *
// * the Initial Developer. All Rights Reserved.                               *
// *                                                                           *
// * Contributor(s): Steven Tine                                               *
// *                                                                           *
// **************************END LICENSE BLOCK**********************************


//These values are defaulted here, but read from pref at init
//  These values are only used from extension startup until read from pref
var   gCsDbgEnabled=false;     //Defines if debug is enable or not.    

var   gCsDbgOsConsole=false;   //Defines if we write to the OS console
                               //  via (firefox.exe -console)
var   gCsDbgErrConsole=false;  //Defines if we write to the FF Error Console
                               //  via Tools->Error Console
var   gCsDbgFile=null;         //The file handle to write to if enabled

var   gCsLoggerListener=null; //Observer for logging preferences.
                               // It's global so it can be deleted at close

//Called only per window instance that uses this logger
function cookieswap_loggerInit()
{
   //Register an observer to watch for debug preferences changes
   //  (it calls the observer at startup for each pref)
   gCsLoggerListener = new cookieswap_prefListener("extensions.cookieswap.debug.",
                                                     cookieswap_loggerPrefChanged)
   gCsLoggerListener.register();

   cookieswap_dbg("END cookieswap_loggerInit");
}

function cookieswap_loggerClose()
{
   if (gCsLoggerListener != null)
   {
      //This is key to prevent memory leak   
      gCsLoggerListener.unregister();
      gCsLoggerListener=null;
   }

   if (gCsDbgFile != null)
   {
      gCsDbgFile.close();
   }
   gCsDbgFile = null;

}

//This function is called for each logger Pref at startup and each time
//  the preference is changed by the user
function cookieswap_loggerPrefChanged(branch, name)
{
   cookieswap_dbg("loggerPrefChanged(" + branch + "," + name + ")");
   cookieswap_dbg("BEFORE gCsDbgEnabled=" + gCsDbgEnabled + 
                  " gCsDbgErrConsole=" + gCsDbgErrConsole +
                  " gCsDbgOsConsole=" + gCsDbgOsConsole +
                  " gCsDbgFile=" + gCsDbgFile);
   switch (name) 
   {
       case "GeneralBrowserEnable":
           // extensions.cookieswap.debug.GeneralBrowserEnable was changed
           gCsDbgEnabled = branch.getBoolPref(name);
           break;
       case "GeneralXpcomEnable":
           // extensions.cookieswap.debug.GeneralXpcomEnable was changed
           //Not relevant here in the browser/chrome
           break;
       case "ErrorConsole":
           // extensions.cookieswap.debug.ErrorConsole was changed
           //Defines if we write to the Firefox Error Console (Tools->Error Console)
           gCsDbgErrConsole = branch.getBoolPref(name);   
           break;
       case "OsConsole":
           // extensions.cookieswap.debug.OsConsole was changed
           //Defines if we write to the OS console (firefox.exe -console)
           gCsDbgOsConsole = branch.getBoolPref(name);   
           break;
       case "File":
           // extensions.cookieswap.debug.File was changed
           //Defines if we write to a file
           //TODO Finish this as the can't work from all the diff windows at once
           var filename = branch.getCharPref(name);   
           filename = "";  //TEMP to disable all this code below
           if (filename != "")
           {
              cookieswap_dbg("[cookieswap]: Creating file '" + filename + "'");
              //This will get the directory of the current Mozilla profile.
              //  We'll put the CookieSwap dir under there since Firefox's cookies.txt file
              //  is stored in this profile dir.
              var logFile = Components.classes["@mozilla.org/file/directory_service;1"]
                             .getService(Components.interfaces.nsIProperties)
                             .get("ProfD", Components.interfaces.nsIFile);
              logFile.append(COOKIE_SWAP_DIR_NAME);
              logFile.append(filename);
     
              if (logFile.exists() == true)
              {
                 logFile.remove(true);
              }
              logFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, COOKIE_FILE_PERMISSIONS);
              cookieswap_dbg("[cookieswap]: Created" );
     
              gCsDbgFile = ffGetFileOutputStream();
              //Open the file with default flags and default permission
              gCsDbgFile.init(logFile, -1, -1, 0);
              cookieswap_dbg("[cookieswap]: Inited" );
           }
           else
           {
              //No filename specified
 
              //If a file is open, close it
              if (gCsDbgFile != null)
              {
                 gCsDbgFile.close();
              }
              gCsDbgFile = null;
           }
           break;
   }
   cookieswap_dbg("AFTER gCsDbgEnabled=" + gCsDbgEnabled + 
                  " gCsDbgErrConsole=" + gCsDbgErrConsole +
                  " gCsDbgOsConsole=" + gCsDbgOsConsole +
                  " gCsDbgFile=" + gCsDbgFile);

}

function cookieswap_turnOnConsoleDebug()
{
   //I don't know the details here...I found this on a Mozilla example web page but it enables
   //  all "dump()" command to be sent to STDOUT and can be seen when firefox.exe is run from a
   //  command window.
   const PREFS_CID      = "@mozilla.org/preferences;1";
   const PREFS_I_PREF   = "nsIPref";
   const PREF_STRING    = "browser.dom.window.dump.enabled";
   try 
   {
       var Pref        = new Components.Constructor(PREFS_CID, PREFS_I_PREF);
       var pref        = new Pref( );
       pref.SetBoolPref(PREF_STRING, true);
   } catch(e) {}

   cookieswap_dbg("Testing STDOUT...debug on!");
}

function cookieswap_dbg(str)
{
   //It may seem odd to have one var to turn debug on/off then numerous vars to
   //  decide where to log, but it is designed to optimize the common case where
   //  debug is off.  In that case we only check one variable
   if (gCsDbgEnabled == true)
   {
      var logPrefixString = "[cookieswap]";

      if (gCsDbgErrConsole == true)
      {
         //To log to the javascript console (Tools->Error Console) use these lines
         var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                    .getService(Components.interfaces.nsIConsoleService);
         consoleService.logStringMessage(logPrefixString + str );
      } 

      //--Write to OS console
      if (gCsDbgOsConsole == true)
      {
        dump(logPrefixString + str + "\n");
      }

      //--Write to debug file 
      if (gCsDbgFile != null)
      {
         var tmp_string = logPrefixString + str + "\n";
         gCsDbgFile.write(tmp_string, tmp_string.length);
         gCsDbgFile.flush();
      }
   }
}


function cookieswap_prefListener(branchName, func)
{
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService);
    var branch = prefService.getBranch(branchName);
    branch.QueryInterface(Components.interfaces.nsIPrefBranch2);

    this.register = function()
    {
        branch.addObserver("", this, false);
        branch.getChildList("", { })
              .forEach(function (name) { func(branch, name); });
    };

    this.unregister = function unregister()
    {
        if (branch)
            branch.removeObserver("", this);
    };

    this.observe = function(subject, topic, data)
    {
        if (topic == "nsPref:changed")
            func(branch, data);
    };
}


function cookieswap_loggerFileClose() 
{
   gCsDbgFile.close();
}



