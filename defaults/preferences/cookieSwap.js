// *****************************************************************************
// *                          cookieSwap.js                                    *
// * This file contains the default values for the CookieSwap preferences      *
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
// *  SteveTine  25Jan2007  Trac4   Initial Creation                           *
// *  SteveTine  31Jan2007  Trac4   Removed in favor of using an icon          *
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

//To modify this pref after install access "about:config" (GUI to come)

//What pages to reload after a profile swap (None=0/Page=1/Window=2/AllWindows=3)?
pref("extensions.cookieswap.options.ReloadOnProfileChange", 1);

//What menu items to enable...Remove all cookies
pref("extensions.cookieswap.options.MenuEnable.cookieswap-menu-remove-all-cookies", true);

//What menu items to enable...Remove all cookies (all profiles)
pref("extensions.cookieswap.options.MenuEnable.cookieswap-menu-remove-all-profile-cookies", true);

//What menu items to enable...Manage Profiles
pref("extensions.cookieswap.options.MenuEnable.cookieswap-menu-manage-profiles", true);

//What menu items to enable...Help
pref("extensions.cookieswap.options.MenuEnable.cookieswap-menu-help", false);

//What menu items to enable...About
pref("extensions.cookieswap.options.MenuEnable.cookieswap-menu-about", true);

//Delay when left-clicking the status bar
pref("extensions.cookieswap.options.MenuPopupDelay", 0);

//---------General enable from chrome/browser + XPCOM component------
//Should debug from the browser/chrome be sent to the Error Console 
pref("extensions.cookieswap.debug.GeneralBrowserEnable", false);

//Should debug from the XPCOM component be sent to the Error Console 
pref("extensions.cookieswap.debug.GeneralXpcomEnable", false);

//--------If either of the above are set to true, the following
//        defines where the messages go

//If General debug enabled, this defines if the messages go to the
//  FF Error Console (Tools -> Error Console)
pref("extensions.cookieswap.debug.ErrorConsole", false);

//If General debug enabled, this defines if the messages go to the
//  OS Console (firefox.exe -console)
pref("extensions.cookieswap.debug.OsConsole", false);

//If General debug enabled, this defines if the XPCOM messages
//  are logged to a file (this is the filename)
pref("extensions.cookieswap.debug.File", "");


