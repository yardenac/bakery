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

//Since the CookieSwapProfileManager is accessed often store it as a global
//  once instantiated
var   gCsProfileMgr=null;

//The observer that gets called when a profile change occurs
//(keep as global to deregister the observer on window close)
var   gCsWindowObserver=null;

//The timer that can automatically switch to the next profile
//  on a periodic basis
var   gCsPeriodicTimerId=0;
const MIN_PERIODIC_TIME_IN_MS=1000;

//The timer for delaying the cookieSwap menu on left-click
var   gCsMenuDelayTimerId=0;

//This var tells what pages to reload after a profile swap.
//To make swaps more efficient, observe pref val changes and store
//  as a global instead of fetching it on each swap
const NO_RELOAD_ON_PROFILE_CHANGE=0           //Perform no reload
const PAGE_RELOAD_ON_PROFILE_CHANGE=1         //Reload curr page
const WINDOW_RELOAD_ON_PROFILE_CHANGE=2       //Reload all tabs on curr window
const ALL_WINDOWS_RELOAD_ON_PROFILE_CHANGE=3  //Reload all tabs in all windows
var gPageReloadObserver=null;                 //Observer
var gReloadOnProfileChange=NO_RELOAD_ON_PROFILE_CHANGE;  //Reload page setting
var gMenuPopupDelay=0;                        //Menu popup delay on left-click

//Defines that are part of the interface definiton with the ProfileMgr Service
const INVALID_PROFILE_ID=-1;

//Called only once at browser startup
function cookieswap_init(event)
{
   cookieswap_dbg("START cookieswap_init");
   
   //Deregister this init function since we only want to run it once
   window.removeEventListener("load", cookieswap_init, true);
   
   //Register the destructor function to run when the window closes
   window.addEventListener("unload", cookieswap_dtor, false);
  
   //Initialize the Cookieswap Logger
   cookieswap_loggerInit(); 

   //Register an observer to watch for preference changes
   //  (it calls the observer at startup for each pref)
   gPageReloadObserver = new cookieswap_prefListener("extensions.cookieswap.options.",
                                                     cookieswap_PageReloadPrefObserver);
   gPageReloadObserver.register();
 
   //The the profileUI instance
   var profile_UI = profileUI_getInstance();

   // instantiate CookieSwap profile manager component object
   gCsProfileMgr = Components.classes["@cookieswap.mozdev.org/profile/manager-service;1"].
                             getService(Components.interfaces.nsIProfile);
   cookieswap_dbg("Created ProfileMgr Service");

   var csProfileMgrPref = Components.classes["@cookieswap.mozdev.org/profile/manager-service;1"].
                             getService(Components.interfaces.nsIPrefBranch);
   cookieswap_dbg("Created ProfileMgr Pref Service");
   if (csProfileMgrPref.getBoolPref("?PRIV_BROWSING?") == true)
   {
      //Check to see if ProfileMgr is private browsing
      cookieswap_dbg("CookieProfileMgr is PRIV_BROWSING");
      profile_UI.enterPrivateBrowsing();
   }

   //Register the window observer
   gCsWindowObserver = new cookieswap_Observer();

   //Register the function that is to be called when a user selected to
   //  change the profile
   profile_UI.registerProfileSelectedCallback(cookieswap_profileChangeSelected);

   //Get the list of profiles and send them to the UI for display
   cookieswap_populateProfilesToUI(profile_UI);
         
   cookieswap_dbg("END cookieswap_init");
}

function cookieswap_populateProfilesToUI(profile_UI)
{
   var obj = Object();
   var profile_array;

   //obj.value is the count, profile_array is the array
   cookieswap_dbg("calling csProfileMgr.getProfileList");
   profile_array = gCsProfileMgr.getProfileList(obj);
   
   cookieswap_dbg("ProfileMgr says " + obj.value + " profiles exist");
   //Populate the UI with the profiles available
   for(var i=0; i<obj.value; i++)
   {
      cookieswap_dbg("adding profile:" + profile_array[i]);
      profile_UI.addProfileToList(profile_array[i], i);
   }

   //Show the currently active profile as active on the UI
   profile_UI.showProfileAsActive(gCsProfileMgr.currentProfile);
}

//This function is called whenever a cookieswap pref is changed
function cookieswap_PageReloadPrefObserver(branch, name)
{
   var menu_enable_branch = "MenuEnable."
   cookieswap_dbg("Observed prof change to " + name);

   //First check to see if its a menu item to be disabled
   if (name.substring(0, menu_enable_branch.length) == menu_enable_branch)
   {
      //Now set the visibility of various menu items.
      //The easiest thing to do is simply use the remainder of the pref string but I'm not sure
      //  an extension should blindly set the visibility based on a pref.  At least check to make
      //  sure it's a cookieswap-menu item.
      var  menu_item=name.substring(menu_enable_branch.length)
      var  cookieswap_menu="cookieswap-menu";
      if (menu_item.substring(0,cookieswap_menu.length) == cookieswap_menu)
      {
         //Make the menu item's visibility based on the pref
         var hidden_val = branch.getBoolPref(name);
         document.getElementById(menu_item).hidden = !hidden_val; //hidden is opposite of enable
         cookieswap_dbg(name + " menu item's visibility now " + hidden_val);
      } 
   }
   else
   {
      switch (name) 
      {
          case "ReloadOnProfileChange":
              // extensions.cookieswap.PageReloadOnProfileChange was changed
              gReloadOnProfileChange = branch.getIntPref(name);
              cookieswap_dbg("gReloadOnProfileChange changed to " + gReloadOnProfileChange );
              break;
          case "MenuPopupDelay":
              // extensions.cookieswap.MenuPopupDelay was changed
              gMenuPopupDelay = branch.getIntPref(name);
              cookieswap_dbg("gMenuPopupDelay changed to " + gMenuPopupDelay);

              var statusbar_panel = document.getElementById("cookieSwap-panel");
              if (gMenuPopupDelay == 0)
              {
                 //With no delay, we can simply set the popup attribute to the menu list
                 statusbar_panel.setAttribute("popup", "cookie-element-list");
                 statusbar_panel.setAttribute("onclick", "");
              }
              else
              {
                 //To implement a delay, we need to set the onclick attribute and implement
                 //  the delay ourselves
                 statusbar_panel.setAttribute("popup", "");
                 statusbar_panel.setAttribute("onclick", "cookieswap_statusBarClick()");
              }
  
              break;
      }
   }
}

//This function is registered with the ProfileUI class and is called
//  whenever the user selects a new cookie profile (or the same profile)
//In the case where the same profile is selected, the cookies are copied
//  to the profile storage area.
function cookieswap_profileChangeSelected(profileID)
{
   cookieswap_dbg("START switchProfile to " + profileID + " reload=" + gReloadOnProfileChange);

   gCsProfileMgr.currentProfile = profileID;

   //The only reason this should fail is if the ProfileManager 
   //  couldn't swap to the requested profile
   if (gCsProfileMgr.currentProfile != profileID)
   {
      alert("[cookieswap] Internal error, swap not successful");
   }

   //---------------------
   //Now check to see if the user wants to auto-reload
   switch (gReloadOnProfileChange)
   {
      //Auto reload all tabs in all windows?
      case ALL_WINDOWS_RELOAD_ON_PROFILE_CHANGE:
         var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                            .getService(Components.interfaces.nsIWindowMediator);
         var browserEnumerator = wm.getEnumerator("navigator:browser");
    
         //Walk through all browser instances
         while (browserEnumerator.hasMoreElements()) 
         {
           var browserWin = browserEnumerator.getNext();
           var tabbrowser = browserWin.getBrowser();
   
           //Walk through all tabs of the browser
           var numTabs = tabbrowser.browsers.length;
           for(var index=0; index<numTabs; index++) 
           {
             var currentBrowser = tabbrowser.getBrowserAtIndex(index);

             //Reload each tab
             currentBrowser.webNavigation.reload(nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);
           }
         }
         break;
  
      //Auto reload all tabs in the current window?
      case WINDOW_RELOAD_ON_PROFILE_CHANGE:
         //Walk through all tabs of the browser
         var numTabs = gBrowser.browsers.length;
         for(var index=0; index<numTabs; index++) 
         {
           var currentBrowser = gBrowser.getBrowserAtIndex(index);

           //Reload each tab
           currentBrowser.webNavigation.reload(nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);
         }
         break;

      //Auto reload the current page?
      case PAGE_RELOAD_ON_PROFILE_CHANGE:
         var currentBrowser = gBrowser.mCurrentBrowser;
         currentBrowser.webNavigation.reload(nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);
         break;

      case NO_RELOAD_ON_PROFILE_CHANGE:
         break;
   }
   cookieswap_dbg("END switchProfile");
}

function cookieswap_runGeneric()
{
   var dnsCacheVal;

   cookieswap_dbg("START runGeneric()");

   //This was something that I was playing with to flush the Firefox DNS cache.
   //To flush the cache, set the network.dnsCacheExipration config value to 0 
   //  (invalidating all entries) then set it back to the original value 
   //  (so new entries get cached again). 
   //
   //Obviously this is something that doesn't belong in CookieSwap, but I had a need for
   //  it and didn't feel like writing a new extension just to do this so it is
   //  stuck in here oddly.
   var net_pref = Components.classes['@mozilla.org/preferences-service;1']
                 .getService(Components.interfaces.nsIPrefService);

   net_pref = net_pref.getBranch('network.');
   dnsCacheVal = net_pref.getIntPref('dnsCacheExpiration'); 
   //Setting the exipration to 0 will invalidate all cached entries
   net_pref.setIntPref('dnsCacheExpiration', 0); 
   //Now set the expiration back to the original value to cause entries to
   //  be cached again.
   net_pref.setIntPref('dnsCacheExpiration', dnsCacheVal); 
   cookieswap_dbg("Set network.dnsCacheExpiration to 0 then back to " + dnsCacheVal);

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

function cookieswap_UiRemoveAllCookiesInAllProfiles()
{
   var do_remove = window.confirm("Are you sure you want to remove all the cookies in all profiles?");

   //If user was sure, remove the cookies
   if (do_remove == true)
   {
      var obj = Object();
      var profile_array;

      //First remove the cookies in browser memory
      cookieswap_removeAllCookies();

      //Get the list of all profiles
      profile_array = gCsProfileMgr.getProfileList(obj);
   
      //Remove the cookies in each profile
      for(var i=0; i<obj.value; i++)
      {
         cookieswap_dbg("Clearing cookies in " + profile_array[i]);
         //The false specifies to delete the contents not the file/profile
         gCsProfileMgr.deleteProfile(profile_array[i], false);
      }

      cookieswap_dbg("All cookies removed");
   }
}
   
function cookieswap_removeAllCookies()
{
   var cookie_mgr = ffGetCookieManager();
   cookie_mgr.removeAll();
   cookieswap_dbg("All cookies removed");
}

function cookieswap_swapToNextProfile()
{
   //This function will make the next profile in the profile list active
   var obj = Object();
   var profile_array;
   var next_profile_name = null;
   var curr_profile_name = gCsProfileMgr.currentProfile;
   
   cookieswap_dbg("START cookieswap_statusBarDblClick");

   cookieswap_dbg("calling csProfileMgr.getProfileList");
   
   //obj.value is the count, profile_array is the array
   profile_array = gCsProfileMgr.getProfileList(obj);
   
   cookieswap_dbg("ProfileMgr says " + obj.value + " profiles exist " +
                  "with the active profile being: " + curr_profile_name);
   //Search the profile list for the currentProfile
   for(var i=0; i<obj.value; i++)
   {
      if(profile_array[i] == curr_profile_name)
      {
         var next_profile_num;

         //Found the active entry in the profile array.  The next entry
         //  is the one after this (mod the num of elements to get element
         //  zero if the current profile is the last one.
         cookieswap_dbg("Found curr profile at " + i);
         next_profile_num = ((i+1) % obj.value);
         next_profile_name = profile_array[next_profile_num];
         cookieswap_dbg("Next profile is " + next_profile_name);
         break;
      }
   }

   if(next_profile_name != null)
   {
      cookieswap_dbg("Swapping to " + next_profile_name);

      //Make it appear that the new profile was selected
      cookieswap_profileChangeSelected(next_profile_name);
   }
   else
   {
      alert("[cookieswap] Internal error, unable to find next profile");
   }

   cookieswap_dbg("END cookieswap_statusBarDblClick");

   return;
}

function cookieswap_statusBarDblClick()
{
   //When users double click on the cookieSwap status bar, we will cycle
   //  to the next profile in the profile list.  
   document.getElementById('cookie-element-list').hidePopup();
   if (gCsMenuDelayTimerId != 0)
   {
       //Cancel the single click time on double click
       clearInterval(gCsMenuDelayTimerId);
       gCsMenuDelayTimerId = 0;
   }
   cookieswap_swapToNextProfile();
}

function cookieswap_statusBarClick()
{
   if (gCsMenuDelayTimerId == 0)
   {
       gCsMenuDelayTimerId = setTimeout(function() {cookieswap_displayCookieSwapMenu();}, gMenuPopupDelay);
   }
      
}

function cookieswap_displayCookieSwapMenu()
{
   var statusbar_panel = document.getElementById("cookieSwap-panel");
   document.getElementById('cookie-element-list').openPopup(statusbar_panel, "after_start", 0, 0, true, false);
   gCsMenuDelayTimerId = 0;
}

//---------------------Periodic timer code-----------------
function cookieswap_promptForPeriodicTimer(timeInMs)
{
   //Ask the user to enter the time in seconds
   var reply = prompt("Enter how much time to wait between\n" +
                      "automatic swaps (in seconds).\n" +
                      "Enter 0 to stop automatic swapping.", "0");

   //Null is returned if the user clicks 'cancel'
   if (reply != null)
   {
      var interval = parseInt(reply);

      if (isNaN(interval))
      {
         alert("The input cannot be parsed to a number");
      }
      else
      { 
         //If a valid number, convert to milliseconds
         if (cookieswap_setPeriodicTimer(reply*1000) != true)
         {
            alert("The value passed in was not valid");
            cookieswap_dbg("cookieswap_setPeriodicTimer() returned false for: " + timeInMs);
         }
         else
         {
            cookieswap_dbg("cookieswap_setPeriodicTimer() returned true for: " + timeInMs);
         }
      }
   }
}

function cookieswap_setPeriodicTimer(timeInMs)
{
   //This function starts a periodic timer running that will swap
   //  to the next profile every 'timeInMs' milliseconds.
   //Passing in 0 will cancel any existing timers that are running.
   //
   //RETURNS: 'true' if the value was valid and the timer was started, 
   //  and 'false' if the timer was never started because the value was invalid.
   var return_val = true;
   cookieswap_dbg("START cookieswap_setPeriodicTimer: " + timeInMs);

   if (isNaN(timeInMs))
   {
      cookieswap_dbg("Non-integer passed to cookieswap_setPeriodicTimer: " + timeInMs);
      return_val = false;
   }
   else
   {
      //Is the request to cancel the timer
      if (timeInMs == 0)
      {
         //Yes, is a timer running?
         if (gCsPeriodicTimerId != 0)
         {
            //Yes, cancel it
            clearInterval(gCsPeriodicTimerId);
            cookieswap_dbg("Cleared previous timer");
         }
         else
         {
            //A request to cancel the timer was received, but no timer is running.
            //Not exactly an error, but worth logging something.
            cookieswap_dbg("Request received to cancel a non-running timer in cookieswap_setPeriodicTimer");
         }
      }
      else
      { 
         //Is the request to start a new timer valid?   
         if (timeInMs > MIN_PERIODIC_TIME_IN_MS)
         {
            if (gCsPeriodicTimerId != 0)
            {
               clearInterval(gCsPeriodicTimerId);
               cookieswap_dbg("Cleared previous timer");
            }
   
            gCsPeriodicTimerId = setInterval(function() {cookieswap_periodicTimerExpire()}, timeInMs);
            cookieswap_dbg("SetInterval to " + timeInMs + " with TimerId " + gCsPeriodicTimerId);
         }
         else
         {
            cookieswap_dbg("Non-integer passed to cookieswap_setPeriodicTimer: " + timeInMs);
            return_val = false;
         }
      }
   }

   cookieswap_dbg("END cookieswap_setPeriodicTimer: " + return_val);
   return return_val;
}


function cookieswap_periodicTimerExpire()
{
   //On timer expiration, switch to the next profile
   cookieswap_swapToNextProfile();
}

function cookieswap_loadProfMgrWin()
{
   var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                      .getService(Components.interfaces.nsIWindowMediator);
   var enumerator = wm.getEnumerator("cookieswap_options");
   var win_found = false;
   var options_win;

   cookieswap_dbg("loadOptionsWin()");
   while(enumerator.hasMoreElements()) 
   {
     options_win= enumerator.getNext();

     //Raise the focus
     cookieswap_dbg("loadOptionsWin(): win.focus()");
     options_win.focus();

     //Select the profile tab
     options_win.document.getElementById('cookieswap-options-tabbox').selectedTab = options_win.document.getElementById('cookieswap-profiles-tab');

     win_found = true;
   }

   if (win_found == false)
   {
      //Window does not exist...open it
      cookieswap_dbg("loadOptionsWin(): opening the window");
      //Pass in the activeTab param to tell the window which tab to make active
      options_win = window.openDialog('chrome://cookie_swap/content/csControlPanel.xul', 'CookieSwap Control Panel', 'chrome,titlebar,toolbar,centerscreen', {activeTab:"cookieswap-profiles-tab"});
   }

   return
}

function cookieswap_loadOptionsWin()
{
   var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                      .getService(Components.interfaces.nsIWindowMediator);
   var enumerator = wm.getEnumerator("cookieswap_options");
   var win_found = false;
   var options_win;

   cookieswap_dbg("loadOptionsWin()");
   while(enumerator.hasMoreElements()) 
   {
     options_win= enumerator.getNext();

     //Raise the focus
     cookieswap_dbg("loadOptionsWin(): win.focus()");
     options_win.focus();

     //Select the options tab
     options_win.document.getElementById('cookieswap-options-tabbox').selectedTab = options_win.document.getElementById('cookieswap-options-tab');

     win_found = true;
   }

   if (win_found == false)
   {
      //Window does not exist...open it
      cookieswap_dbg("loadOptionsWin(): opening the window");
      //Pass in the activeTab param to tell the window which tab to make active
      options_win = window.openDialog('chrome://cookie_swap/content/csControlPanel.xul', 'CookieSwap Control Panel', 'chrome,titlebar,toolbar,centerscreen', {activeTab:"cookieswap-options-tab"});
   }

   return
}

function cookieswap_loadAboutWin()
{
   var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                      .getService(Components.interfaces.nsIWindowMediator);
   var enumerator = wm.getEnumerator("cookieswap_options");
   var win_found = false;
   var options_win;

   cookieswap_dbg("loadOptionsWin()");
   while(enumerator.hasMoreElements()) 
   {
     options_win= enumerator.getNext();

     //Raise the focus
     cookieswap_dbg("loadOptionsWin(): win.focus()");
     options_win.focus();

     //Select the options tab
     options_win.document.getElementById('cookieswap-options-tabbox').selectedTab = options_win.document.getElementById('cookieswap-about-tab');

     win_found = true;
   }

   if (win_found == false)
   {
      //Window does not exist...open it
      cookieswap_dbg("loadOptionsWin(): opening the window");
      //Pass in the activeTab param to tell the window which tab to make active
      options_win = window.openDialog('chrome://cookie_swap/content/csControlPanel.xul', 'CookieSwap Control Panel', 'chrome,titlebar,toolbar,centerscreen', {activeTab:"cookieswap-about-tab"});
   }

   return
}

function cookieswap_loadHelpTab()
{
  //Load the Help page on a new tab
  gBrowser.addTab('http://cookieswap.mozdev.org/help.html');
}

function cookieswap_getVersion()
{
   const extensionManager = Components.classes["@mozilla.org/extensions/manager;1"]
                 .getService(Components.interfaces.nsIExtensionManager);
   return(extensionManager.getItemForID("cookieSwap@cookieSwap.mozdev.org").version);
}

function cookieswap_unitTest()
{
   //------------------UNIT TEST CODE--------------------------
   // This isn't used for anything right now other than to
   // exercise all the methods on the XPCOM component.
   //----------------------------------------------------------
   cookieswap_dbg("calling notify");
   Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .notifyObservers(null, "cookieswap_swap", "someAdditionalInformationPassedAs'Data'Parameter");
   cookieswap_dbg("called notify");
 
   // instantiate component object
   var oProfileMgr = Components.classes["@cookieswap.mozdev.org/profile/manager-service;1"].
                                getService(Components.interfaces.nsIProfile);
                                //createInstance(Components.interfaces.nsIProfile);
   cookieswap_dbg("Created ProfileMgr");
 
   //--cloneProfile
   oProfileMgr.cloneProfile("test");
   cookieswap_dbg("Cloned Profile");
       
   //--profileCount
   cookieswap_dbg("Profile Count = " + oProfileMgr.profileCount);
 
   //--createNewProfile
   oProfileMgr.createNewProfile("test1", "test1dir", "", true);
 
   //--deleteProfile
   oProfileMgr.deleteProfile("test1", true);
   oProfileMgr.deleteProfile("test1", false);
 
   //--getProfileList
   var obj = Object();
   var profile_array;
   
   profile_array = oProfileMgr.getProfileList(obj);
   cookieswap_dbg("obj.value = " + obj.value);
   cookieswap_dbg("profile_array[0] = " + profile_array[0]);
   cookieswap_dbg("profile_array[1]= " + profile_array[1]);
   
   //--profileExists
   cookieswap_dbg("test exists = " + oProfileMgr.profileExists("test"));
   cookieswap_dbg("test1 exists = " + oProfileMgr.profileExists("test1"));
   
   //renameProfile
   oProfileMgr.renameProfile("test", "test2");
   
   //shutDownCurrentProfile
   oProfileMgr.shutDownCurrentProfile(Components.interfaces.nsIProfile.SHUTDOWN_PERSIST);
   oProfileMgr.shutDownCurrentProfile(Components.interfaces.nsIProfile.SHUTDOWN_CLEANSE);
   
   cookieswap_dbg("currentProfile = " + oProfileMgr.currentProfile);
   oProfileMgr.currentProfile = "test1";
   cookieswap_dbg("currentProfile = " + oProfileMgr.currentProfile);
   oProfileMgr.currentProfile = "test2";
   cookieswap_dbg("currentProfile = " + oProfileMgr.currentProfile);
}

//These are the constants used in the cookieswap_swap observer 'subject'
const COOKIE_SWAP_OBSVR_NEW_ACTIVE_PROFILE=1;
const COOKIE_SWAP_OBSVR_NEW_PROFILE_LIST=2;

function cookieswap_Observer()
{
  this.register();
}

cookieswap_Observer.prototype = {
  observe: function(subject, topic, data) {
   // Do your stuff here.
   cookieswap_dbg("Observer called! " + subject + ":" + data);
   //TODO:I don't like the idea that the hardcoded 'RELOAD' data
   //  means to reload the UI (i.e. a profile with that name would fail)
   if (data == "?RELOAD?")
   {
      //The profile list has changed...reinit the UI
      var profile_UI = profileUI_getInstance();
      //Remove all profiles and get the lastest list of profiles 
      //  and send them to the UI for display
      profile_UI.removeAllProfilesFromList();
      cookieswap_populateProfilesToUI(profile_UI);
   }
   else if (data == "?PRIV_BROWSING?")
   {
      cookieswap_enterPrivateBrowsing();
   }
   else if (data == "?NOT_PRIV_BROWSING?")
   {
      cookieswap_exitPrivateBrowsing();
   }
   else
   {
      //A profile swap has happened...update the UI
      var profile_UI = profileUI_getInstance();
      profile_UI.showProfileAsActive(data);
   }
  },
  register: function() {
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                          .getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(this, "cookieswap_swap", false);
  },
  unregister: function() {
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                            .getService(Components.interfaces.nsIObserverService);
    observerService.removeObserver(this, "cookieswap_swap");
  }
}

function cookieswap_enterPrivateBrowsing()
{
   //Entering private browsing mode...disable CookieSwap for now
   var profile_UI = profileUI_getInstance();
   profile_UI.enterPrivateBrowsing();
}

function cookieswap_exitPrivateBrowsing()
{
   //Leavin private browsing mode...enable CookieSwap again
   var profile_UI = profileUI_getInstance();
   profile_UI.exitPrivateBrowsing();
}

//Called when the window closes
function cookieswap_dtor(event)
{
   //Deregister the Window + pref observer to prevent a memory leak
   gCsWindowObserver.unregister();
   gCsWindowObserver = null;
   gPageReloadObserver.unregister();
   gPageReloadObserver = null;

   //Close the Cookieswap Logger
   cookieswap_loggerClose(); 
}

