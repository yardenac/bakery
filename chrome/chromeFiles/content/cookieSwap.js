// *****************************************************************************
// *                          cookieSwap.js                                    *
// * These are the functions that glue all the CookieSwap classes together.    *
// *  It acts as the dividing line between the front-end and back-end.         *
// * It is the high level code that coordinates the cookie swaps.              *
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
// *  SteveTine  28Dec2005  12561   Initial Creation                           *
// *  SteveTine  15Jan2005  12751   Stop-gap solution to multiple window prob  *
// *  SteveTine  18Jan2005  12855   Prompt the user before removing all cookies*
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

//This constant defines if debug to stdout is enable or not.
const COOKIE_SWAP_DEBUG_ENABLED=false;
var   gExtensionActive=true;

//Called only once at browser startup
function cookieswap_init(event)
{
   cookieswap_dbg("START cookieswap_init");
   
   //Deregister this init function since we only want to run it once
   window.removeEventListener("load", cookieswap_init, true);

   var profile_UI = profileUI_getInstance();
   var profile_ctnr = CookieProfileContainer_getInstance();
   var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
            .getService(Components.interfaces.nsIWindowMediator);
   var browser_enumerator = wm.getEnumerator("navigator:browser");
   var i;

   //Determine how many browser windows are currently open
   for(i=0; browser_enumerator.hasMoreElements(); i++) 
   {
      var browser_instance = browser_enumerator.getNext();
   }
   cookieswap_dbg(i + " browsers found");
 
   //If there is only one browser window, then we are the first window.
   //  Currently, we only want to run cookieSwap in the first window
   //  because I don't currently know how to keep more than one in sync.
   if (i == 1)
   {
      //Set the global var to indicate that cookieSwap is active in this browser
      gExtensionActive=true;
      
      //Register the function that is to be called when a user selected to
      //  change the profile
      profile_UI.registerProfileSelectedCallback(cookieswap_profileChangeSelected);

      //Populate the UI with the profiles available
      for(var i=0; i<profile_ctnr.getNumOfProfiles(); i++)
      {
         profile_UI.addProfileToList(profile_ctnr.getProfileName(i), i);
      }

      //Show the currently active profile as active on the UI
      profile_UI.showProfileAsActive(profile_ctnr.getActiveProfileId());
   }
   else
   {
      //Set the global var to indicate that cookieSwap is NOT active in this browser
      gExtensionActive=false;

      cookieswap_dbg("Since this is browser #" + i + ", this browser is inactive");
     
      //Register one profile that when clicked will explain why this browser is
      //  disabled.
      profile_UI.registerProfileSelectedCallback(cookieswap_explainInactiveBrowser);
      profile_UI.addProfileToList("Why inactive?", 0);

      //Show on the UI that cookieSwap is not active in this browser window
      profile_UI.showBrowserAsInactive();
   }
   
   cookieswap_dbg("END cookieswap_init");
}

//This function is registered with the ProfileUI class to be called
//  when the user tries to change profiles in an inactive browser.
function cookieswap_explainInactiveBrowser(profileId)
{
   alert("Sorry, in this release, you can only swap cookies from the first " +
         "browser window opened.");
}

//This function is registered with the ProfileUI class and is called
//  whenever the user selects a new cookie profile (or the same profile)
//In the case where the same profile is selected, the cookies are copied
//  to the profile storage area.
function cookieswap_profileChangeSelected(profileID)
{
   cookieswap_dbg("START switchProfile to " + profileID);

   var profile_ctnr = CookieProfileContainer_getInstance();
   var profile_UI = profileUI_getInstance();

   var old_profile_id = profile_ctnr.getActiveProfileId();
   var old_profile = profile_ctnr.getProfile(old_profile_id);

   var new_profile_id = profileID;
   var new_profile = profile_ctnr.getProfile(new_profile_id);

   //First thing to do is copy all the cookies from the browser and
   //  save them to the profile being swapped out
   if (old_profile != null)
   {
      old_profile.copyFromBrowser();
   }
   else
   {
      alert("[cookieswap] Internal error, profile out is invalid");
   }

   //Next thing to do is to remove the cookies from the browser and copy
   //  in all the cookies associated with the profile being swapped in.
   //BUT, first ensure we set the ActiveProfileID to INVALID so that if
   //  we were to crash, all our profiles will be intact in persistent
   //  memory and we won't come up thinking that the cookies in the browers
   //  are associated with any profile.
   profile_ctnr.setActiveProfileId(INVALID_PROFILE_ID);
   profile_UI.showProfileAsActive(INVALID_PROFILE_ID);

   //Remove all the browser cookies
   cookieswap_removeAllCookies();
  
   if (new_profile != null)
   {
      //Now swap in the cookies from the profile to the browser
      new_profile.copyToBrowser();
      profile_ctnr.setActiveProfileId(new_profile_id);
      profile_UI.showProfileAsActive(new_profile_id);

      cookieswap_dbg("Swap from profile " + old_profile_id + " to " + new_profile_id + " complete");
   }
   else
   {
      alert("[cookieswap] Internal error, profile in is invalid...no cookies swapped in");
   }
   
   cookieswap_dbg("END switchProfile");
}

function cookieswap_runGeneric()
{
   cookieswap_dbg("START runGeneric()");

   cookieswap_dbg("END runGeneric()");
}

function cookieswap_UiRemoveAllCookies()
{
   var do_remove = window.confirm("Are you sure you want to remove all the cookies in this profile?");

   //If user was sure, remove the cookies
   if (do_remove == true)
   {
      cookieswap_removeAllCookies();
   }
}

function cookieswap_removeAllCookies()
{
   var cookie_mgr = ffGetCookieManager();
   cookie_mgr.removeAll();
   cookieswap_dbg("All cookies removed");
}

function cookieswap_turnOnDebug()
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

function cookieswap_statusBarDblClick()
{
}

function cookieswap_dbg(str)
{
   if(COOKIE_SWAP_DEBUG_ENABLED == true)
   {
      dump("[cookieswap]" + str + "\n");
   }
}

function cookieswap_manageProfiles()
{
   var profile_ctnr = CookieProfileContainer_getInstance();

   alert("Sorry...this feature will be in a future release.\n" +
         "Until then, you can add, delete and rename profiles by closing the broswer and \n" +
         "changing the filenames in this dir:\n" +
          profile_ctnr.profileDir.path + "\n" +
          "On Windows, some of these directories may be hidden.  Use Tools->FolderOptions->View->ShowHiddenFilesAndFolders\n" +
          "in the Windows file explorer window to see these hidden directories.\n\n" +
          "See http://cookieswap.mozdev.org/help.html for detailed instructions.\n");
}
