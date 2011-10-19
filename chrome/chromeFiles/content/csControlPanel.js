// *****************************************************************************
// *                           csControlPanel Class                            *
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

//Globals

//This is the listbox in the windows.  Set it once to make it quicker
//  to access in each function below.
var gCsManageList;

//This is the CookieSwap manager.  Set it once to make it quicker
//  to access in each function below.
var gCsProfileMgr; 
var gCsProfileMgrPref;

//The observer that gets called when a profile change occurs
// (keep as global to deregister the observer on window close)
var gCsWindowObserver=null;

//Keep a global copy of the branch with the options for easy reference
var gCsPrefsOptions=null; 

//The text added to the end of the label of the active item in the list
const COOKIESWAP_ACTIVE_PROFILE_SUFFIX=" (active)";

//The delay time to use when left-clicking on the status bar
//  This makes it easier to double-click without the menu getting in the way
const POPUP_DELAY_TIME_IN_MS=300;

//Called when the Control Panel window is opened
function cookieswap_mgrLoad()
{
  var  list_nodes;
  var  list_item;

  //Get the listbox from the UI Window
  gCsManageList = document.getElementById('cookieswap-manage-profile-list');

  //Get the CookieSwap profile manager component object
  gCsProfileMgr = Components.classes["@cookieswap.mozdev.org/profile/manager-service;1"].
                             getService(Components.interfaces.nsIProfile);
  gCsProfileMgrPref = Components.classes["@cookieswap.mozdev.org/profile/manager-service;1"].
                             getService(Components.interfaces.nsIPrefBranch);

  //Initialize the Cookieswap Logger
  cookieswap_loggerInit(); 
  cookieswap_dbg("mgrLoad");

  //Were arguments passed to the window by the opener?
  if("arguments" in window && window.arguments.length > 0) 
  {
     var arguments = window.arguments;

     //Was a tab ID passed in to make it selected?
     if("activeTab" in arguments[0])
     {
        cookieswap_dbg("activeTab passed in is " + arguments[0].activeTab);
        document.getElementById('cookieswap-options-tabbox').selectedTab = document.getElementById(arguments[0].activeTab);
     }
     else
     {
        cookieswap_dbg("no activeTab passed in");
     }
  }
  else
  {
     cookieswap_dbg("no arguments passed in");
  }

  
  //-----Setup the options tab----
  gCsPrefsOptions = Components.classes["@mozilla.org/preferences-service;1"]
                       .getService(Components.interfaces.nsIPrefBranch)
                       .getBranch("extensions.cookieswap.options.");

  //Get the current pref for profile change and set the radio button correctly
  var cs_auto_reload_radiogroup = document.getElementById('cookieswap-auto-reload-radiogroup');
  var cs_auto_reload_setting = gCsPrefsOptions.getIntPref("ReloadOnProfileChange");
  cookieswap_dbg("ReloadOnProfileChange=" + cs_auto_reload_setting );

  //Walk the list of radio buttons looking for the one with the correct value
  if (cs_auto_reload_radiogroup.hasChildNodes())
  {
     var radio_buttons = cs_auto_reload_radiogroup.childNodes;
     for (var i = 0; i < radio_buttons.length; i++) 
     {
        if (parseInt(radio_buttons[i].value) == cs_auto_reload_setting)
        {
           //Set this as the selected item in the group
           cs_auto_reload_radiogroup.selectedItem = radio_buttons[i];
           cookieswap_dbg("ReloadOnProfileChange radiobutton found at index " + i);
           break;
        }
     }
  }

  //Now the menu checkboxes
  var curr_checkbox;
  curr_checkbox = document.getElementById('cs-pref-menu-remove-all-cookies');
  curr_checkbox.checked = gCsPrefsOptions.getBoolPref("MenuEnable.cookieswap-menu-remove-all-cookies");

  curr_checkbox = document.getElementById('cs-pref-menu-remove-all-profile-cookies');
  curr_checkbox.checked = gCsPrefsOptions.getBoolPref("MenuEnable.cookieswap-menu-remove-all-profile-cookies");

  curr_checkbox = document.getElementById('cs-pref-menu-manage-profiles');
  curr_checkbox.checked = gCsPrefsOptions.getBoolPref("MenuEnable.cookieswap-menu-manage-profiles");

  curr_checkbox = document.getElementById('cs-pref-menu-help');
  curr_checkbox.checked = gCsPrefsOptions.getBoolPref("MenuEnable.cookieswap-menu-help");

  curr_checkbox = document.getElementById('cs-pref-menu-about');
  curr_checkbox.checked = gCsPrefsOptions.getBoolPref("MenuEnable.cookieswap-menu-about");

  curr_checkbox = document.getElementById('cs-pref-menu-delay');
  if (gCsPrefsOptions.getIntPref("MenuPopupDelay") > 0)
  {
     curr_checkbox.checked = true;
  }
  else
  {
     curr_checkbox.checked = false;
  }
  
  //-----Setup the profiles tab----

  //Build the profile list
  cookieswap_mgrInitList();

  //Register to be notified if a new profile is active so we can update the UI
  if (gCsWindowObserver == null)
  {
     gCsWindowObserver = new cookieswap_ProfileMgrObserver();
  }

  //-----Lastly the about tab-----
  var version_label = document.getElementById('cookieswap-about-version');
  version_label.value = cookieswap_getVersion();
}

function cookieswap_mgrInitList()
{
  var  list_nodes;
  var  list_item;

  cookieswap_dbg("Entering cookieswap_mgrInitList()");

  //Clear the list
  list_nodes = gCsManageList.childNodes;
  for(var i = list_nodes.length-1; i>=0; i--)
  {
     gCsManageList.removeChild(list_nodes[i]);
  }

  //--------------

  //Get the list of profiles
  var obj = Object();
  var profile_array;
  var active_profile;

  //obj.value is the count, profile_array is the array
  //cookieswap_dbg("calling csProfileMgr.getProfileList");
  profile_array = gCsProfileMgr.getProfileList(obj);
  active_profile = gCsProfileMgr.currentProfile;

  //Populate the list
  for(var i=0; i<obj.value; i++)
  {
     var profile_name = profile_array[i];
     var profile_label;
     var profile_active;

     //In the lable show which profile is active
     if (profile_name == active_profile)
     {
        profile_label = profile_name + COOKIESWAP_ACTIVE_PROFILE_SUFFIX;
        profile_active = true;
     }
     else
     {
        profile_label = profile_name;
        profile_active = false;
     }
     cookieswap_dbg("adding profile:" + profile_label);

     //We'll create a new listitem for the profile
     list_item = gCsManageList.appendItem(profile_label, i); 
     list_item.setAttribute("profile_name", profile_name);
     list_item.setAttribute("profile_active", profile_active);
  }

  //Properly initialize the buttons
  cookieswap_mgrSelect(gCsManageList.selectedItem);

  //Register the cleanup function to run when the window closes
  window.addEventListener("unload", cookieswap_mgrCleanup, false);
}

//Called when the ManageProfile window is closed gracefully
function cookieswap_mgrClose()
{
  cookieswap_dbg("mgrClose");

  //--First handle the options
  var cs_auto_reload_radiogroup = document.getElementById('cookieswap-auto-reload-radiogroup');
  var new_pref_value=parseInt(cs_auto_reload_radiogroup.selectedItem.value);
  gCsPrefsOptions.setIntPref("ReloadOnProfileChange", new_pref_value);
  cookieswap_dbg("ReloadOnProfileChange now set to " + new_pref_value);
  
  //--Now the menu checkboxes
  var curr_checkbox;
  curr_checkbox = document.getElementById('cs-pref-menu-remove-all-cookies');
  gCsPrefsOptions.setBoolPref("MenuEnable.cookieswap-menu-remove-all-cookies", curr_checkbox.checked);

  curr_checkbox = document.getElementById('cs-pref-menu-remove-all-profile-cookies');
  gCsPrefsOptions.setBoolPref("MenuEnable.cookieswap-menu-remove-all-profile-cookies", curr_checkbox.checked);

  curr_checkbox = document.getElementById('cs-pref-menu-manage-profiles');
  gCsPrefsOptions.setBoolPref("MenuEnable.cookieswap-menu-manage-profiles", curr_checkbox.checked);

  curr_checkbox = document.getElementById('cs-pref-menu-help');
  gCsPrefsOptions.setBoolPref("MenuEnable.cookieswap-menu-help", curr_checkbox.checked);

  curr_checkbox = document.getElementById('cs-pref-menu-about');
  gCsPrefsOptions.setBoolPref("MenuEnable.cookieswap-menu-about", curr_checkbox.checked );
  
  curr_checkbox = document.getElementById('cs-pref-menu-delay');
  if (curr_checkbox.checked == true)
  {
     gCsPrefsOptions.setIntPref("MenuPopupDelay", POPUP_DELAY_TIME_IN_MS)
  }
  else
  {
     gCsPrefsOptions.setIntPref("MenuPopupDelay", 0)
  }

  //--Now the profile list
  gCsManageList=null;
}

//Called when the ManageProfile window is closed with a cancel
function cookieswap_mgrCancel()
{
  cookieswap_dbg("mgrCancel");
  gCsManageList=null;
}

//Called when the ManageProfile window is closed with either Close or Cancel 
function cookieswap_mgrCleanup()
{
  cookieswap_dbg("mgrCleanup");
  //Deregister the Observer
  if (gCsWindowObserver != null)
  {
     gCsWindowObserver.unregister();
     gCsWindowObserver = null;
  }

  //Close the Cookieswap Logger
  cookieswap_loggerClose(); 

  //Now unregister this function
  window.removeEventListener("unload", cookieswap_mgrCleanup, false);
}

//Called when the ManageProfile window's NEW button is clicked
function cookieswap_mgrNew()
{
  cookieswap_dbg("enter cookieswap_mgrNew()");

  var reply = prompt("Enter profile name:", "");
  if (reply != null && reply != "")
  {
     if (cookieswap_mgrDoesProfileExist(reply))
     {
        alert("A profile with that name already exists"); 
     }
     else
     {
        //Ready to create the profile.  Don't perform checking here to determine
        //  if the name is valid for the file system.  Just catch that exception.
        cookieswap_dbg("createNewProfile(" + reply + ")");
        try
        {
           //Request the new profile
           gCsProfileMgr.createNewProfile(reply, null, null, null);
        }
        catch (err) 
        { 
           //Rename through exception.  Most likely because the chars provided
           //  are not valid for a filename
           cookieswap_dbg("createNewProfile exception:" + err); 
           alert("Creation failed.  CookieSwap profiles must only use characters that are valid in file names."); 
        }
        cookieswap_dbg("item added");
     }
  }
  else
  {
     cookieswap_dbg("no profile name provided in mgrNew");
  }
}

//Called when the ManageProfile window's EDIT button is clicked
function cookieswap_mgrRename()
{
  cookieswap_dbg("enter cookieswap_mgrRename()");

  var list_item; 
  list_item = gCsManageList.selectedItem;

  if(list_item != null)
  {
     var profile_name = list_item.getAttribute("profile_name");
     cookieswap_dbg("mgrRename...profile_name:" + profile_name + " value:" + list_item.value + 
           " MyInfo:" + list_item.getAttribute("MyInfo"));
     var reply = prompt("Enter new name for profile:", profile_name);
     if (reply != null && reply != profile_name)
     {
        if (cookieswap_mgrDoesProfileExist(reply))
        {
           alert("A profile with that name already exists"); 
        }
        else
        {
           //Ready to rename the profile.  Don't perform checking here to determine
           //  if the name is valid for the file system.  Just catch that exception.
           cookieswap_dbg("renameProfile(" + profile_name + "," + reply + ")");
           try
           {
              //Request the profile rename
              gCsProfileMgr.renameProfile(profile_name , reply);
           }
           catch (err) 
           { 
              //Rename through exception.  Most likely because the chars provided
              //  are not valid for a filename
              cookieswap_dbg("renameProfile exception:" + err); 
              alert("Rename failed.  CookieSwap profiles must only use characters that are valid in file names."); 
           }
   
           cookieswap_dbg("item renamed");
        }
     }
     else
     {
        cookieswap_dbg("no profile name (or the same one provided) in mgrRename");
     }
  }
  else
  {
     //This shouldn't happen
     alert("Please select a profile to rename");
  }
}

//Called when the ManageProfile window's REMOVE button is clicked
function cookieswap_mgrDelete()
{
  cookieswap_dbg("enter cookieswap_mgrDelete()");

  var list_item; 
  list_item = gCsManageList.selectedItem;

  if(list_item != null)
  {
     var profile_name = list_item.getAttribute("profile_name");
     cookieswap_dbg("mgrDelete...profile_name :" + profile_name + " value:" + list_item.value + 
           " MyInfo:" + list_item.getAttribute("MyInfo"));
     
     var resp=window.confirm("Permanently delete the '" + profile_name + "' profile?");
     if (resp == true)
     {
        try
        {
           //Request the profile rename
           gCsProfileMgr.deleteProfile(profile_name , true);
        }
        catch (err) 
        { 
           //Rename through exception.  Most likely because the chars provided
           //  are not valid for a filename
           cookieswap_dbg("deleteProfile exception:" + err); 
           alert("Delete failed. " + err); 
        }
        cookieswap_dbg("item deleted");
     }
  }
  else
  {
     //Shouldn't happen
     alert("Please select a profile to delete");
  }
}

//Called when a profile in the listbox is selected
function cookieswap_mgrSelect(listboxSelectedItem)
{
  var remove_button = document.getElementById('remove-button');
  var edit_button = document.getElementById('edit-button');
  var new_button = document.getElementById('new-button');
  var disabled_label = document.getElementById('cs-mgr-private-browsing-label');

  if (gCsProfileMgrPref.getBoolPref("?PRIV_BROWSING?") == true)
  {
     //When private browsing, don't allow management operations.
     //  Show the label showing we are disabled and disable the buttons.
     disabled_label.hidden = false;
     remove_button.disabled = true; 
     edit_button.disabled = true;  
     new_button.disabled = true
  }
  else
  {
     //Default the buttons to enabled, and disable if the selected
     // profile is active
     disabled_label.hidden = true;  //Not private browsing, so not disabled (aka hidden=true)
     remove_button.disabled = false; 
     edit_button.disabled = false;  
     new_button.disabled = false;

     if(listboxSelectedItem != null)
     {
        //Is the selected item the current profile?
        var profile_active = listboxSelectedItem.getAttribute("profile_active");
        //Note getAttribute always returs a string even though we set a bool
        if(profile_active == "true")
        {
           //Yes, don't allow remove of the active profile
           cookieswap_dbg("mgrSelect() called with active profile");
           remove_button.disabled = true; 
        }
     }
     else
     {
        //This happens when we reinitialize the list and an item
        // was selected
        cookieswap_dbg("mgrSelect(null) called");

        //Can edit/delete without a selected profile
        remove_button.disabled = true; 
        edit_button.disabled = true;  
     }
  }

}

//Returns true if the profile name provided is an already existing profile
function cookieswap_mgrDoesProfileExist(profileName)
{
  var ret_val = false;
  var list_nodes = gCsManageList.childNodes;

  for(var i = list_nodes.length-1; i>=0; i--)
  {
     var profile_name = list_nodes[i].getAttribute("profile_name");
     if (profile_name == profileName)
     {
        //Yes, there is a profile with that name in the list
        ret_val = true;
        break;
     }
  }

  return (ret_val);
}

//Opens a link in a browser tab.  Note: 'opener' is not safe to use
//  as it may be the Add-ons window which is not a browser
function cookieswap_mgrOpenLinkInBrowserTab(url)
{
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var browserWindow = wm.getMostRecentWindow("navigator:browser").getBrowser();

  browserWindow.selectedTab = browserWindow.addTab(url);
}

function cookieswap_ProfileMgrObserver()
{
  this.register();
}
cookieswap_ProfileMgrObserver.prototype = {
  observe: function(subject, topic, data) {
   // Do your stuff here.
   cookieswap_dbg("ProfileMgrObserver called! " + subject + ":" + data);
   //TODO:I don't like the idea that the hardcoded 'RELOAD' data
   //  means to reload the UI (i.e. a profile with that name would fail)
   if (data == "?RELOAD?")
   {
      //The profile list has changed...reinit the UI
      cookieswap_mgrInitList(); //Repopulate list 
   }
   else if (data == "?NOT_PRIV_BROWSING?" || data == "?PRIV_BROWSING?") 
   {
      //Private browsing state change.  Simulate select event to update buttons
      cookieswap_mgrSelect(gCsManageList.selectedItem)
   }
   else  //Profile change
   {
      //First clear all the selected profiles (there should at most one)
      cookieswap_dbg("Finding list items with profile_active==true");
      var active_items = gCsManageList.getElementsByAttribute("profile_active", true);
      if (active_items != null)
      {
         for(var i=0; i<active_items.length; i++)
         {
            cookieswap_dbg("Clearing: " + active_items[i].label);

            //For the active profile, change the label to just the name
            //  and clear the profile_active flag
            var profile_name = active_items[i].getAttribute("profile_name");
            active_items[i].label = profile_name;
            active_items[i].setAttribute("profile_active", false);
         }
      }

      //Find the new active profile (there should be at most one)
      active_items = gCsManageList.getElementsByAttribute("profile_name", data);
      if (active_items != null)
      {
         for(var i=0; i<active_items.length; i++)
         {
            cookieswap_dbg("Setting: " + active_items[i].label);
            //For the active profiles, change the label to add the suffix
            //  and set the profile_active flag
            active_items[i].label = data + COOKIESWAP_ACTIVE_PROFILE_SUFFIX;
            active_items[i].setAttribute("profile_active", true);
         }
      }

      //A profile swap has happened...update the UI by emulating a select event
      cookieswap_mgrSelect(gCsManageList.selectedItem)
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

