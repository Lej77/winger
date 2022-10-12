import * as Settings from './settings.js';
import * as Window from './window.js';
import * as Name from './name.js';
import * as Action from './action.js';
import * as Chrome from './chrome.js';
import * as SendMenu from './menu.send.js';
let Stash, UnstashMenu; // Optional modules

//@ -> state
function debug() {
    const modules = { Settings, Window, Name, Action, SendMenu, Stash, UnstashMenu };
    console.log(`Debug mode on - Exposing: ${Object.keys(modules).join(', ')}`);
    Object.assign(window, modules);
}

init();

browser.windows.onCreated.addListener      (onWindowCreated);
browser.windows.onRemoved.addListener      (onWindowRemoved);
browser.windows.onFocusChanged.addListener (onWindowFocused);

browser.menus.onShown.addListener          (onMenuShown);
browser.menus.onHidden.addListener         (onMenuHidden);
browser.menus.onClicked.addListener        (onMenuClicked);

browser.runtime.onInstalled.addListener    (onExtensionInstalled);
browser.runtime.onMessage.addListener      (onRequest);

//@ state -> state
async function init() {
    const [SETTINGS, windows] = await Promise.all([ Settings.get(), browser.windows.getAll() ]);

    Action.init(SETTINGS);
    Chrome.init(SETTINGS);

    if (SETTINGS.enable_stash) {
        [Stash, UnstashMenu] =
            await Promise.all([ import('./stash.js'), import('./menu.unstash.js') ]);
        Stash.init(SETTINGS);
    }

    await Window.add(windows);
    for (const window of windows) onWindowCreated(window, true);
}

//@ (Object, Boolean), state -> state
async function onWindowCreated(window, isInit) {
    const windowId = window.id;
    if (window.focused) onWindowFocused(windowId);

    if (isInit) return;

    await Window.add([window]);
    Action.selectFocusedTab(windowId);
    Stash?.unstash.onWindowCreated(windowId);
}

//@ (Number), state -> state
function onWindowRemoved(windowId) {
    Window.remove(windowId);
}

//@ (Number), state -> state
function onWindowFocused(windowId) {
    if (windowId in Window.winfoDict) Window.winfoDict[windowId].lastFocused = Date.now();
}

//@ (Object, Object), state -> state|null
async function onMenuShown(info, tab) {
    await UnstashMenu?.handleShow(info) || SendMenu.handleShow(info, tab);
}

//@ -> state
function onMenuHidden() {
    SendMenu.handleHide();
    UnstashMenu?.handleHide();
}

//@ (Object, Object), state -> state|null
function onMenuClicked(info, tab) {
    UnstashMenu?.handleClick(info) || SendMenu.handleClick(info, tab);
}

//@ (Object) -> state
function onExtensionInstalled(details) {
    if (details.reason === 'install') Action.openHelp();
}

//@ (Object), state -> (Promise: Object|Boolean|null), state|null
async function onRequest(request) {
    if (request.popup) return {
        winfos:           Window.sortedWinfos(),
        selectedTabCount: (await Action.getSelectedTabs()).length,
        stashEnabled:     !!Stash,
    };
    if (request.stash)     return Stash.stash(request.stash, request.close);
    if (request.action)    return Action.execute(request);
    if (request.help)      return Action.openHelp();
    if (request.checkName) return Name.check(request.checkName, request.name);
    if (request.setName)   return Name.set(request.setName, request.name);
    if (request.settings)  return Settings.SETTINGS;
    if (request.debug)     return debug();
}
