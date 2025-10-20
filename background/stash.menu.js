import { getNode, isRootId, nowStashing, nowUnstashing } from './stash.core.js';
import * as stashMain from './stash.main.js';
import * as StashProp from './stash.prop.js';

import { getSelectedTabs } from './action.js';

import { STASHCOPY } from '../modifier.js';
import * as Storage from '../storage.js';

/** @import { WindowId, BNodeId } from '../types.js' */

const contexts = ['bookmark']; // Menu only appears if bookmarks permission granted
const parentId = 'bookmark';
const menuItemBase = { contexts, parentId, enabled: false }; // Start out disabled
const stashMenuItem = { ...menuItemBase, id: 'stash', title: '&Send Tab Here', icons: { 16: 'icons/send.svg' } };
const unstashMenuItem = { ...menuItemBase, id: 'unstash', title: '&Unstash', icons: { 16: 'icons/unstash.svg' } };

export function init() {
    browser.menus.create({ contexts, id: parentId, title: '&Winger' });
    browser.menus.create(stashMenuItem);
    browser.menus.create({ ...menuItemBase, id: 'stashMenuSeparator', type: 'separator' });
    browser.menus.create(unstashMenuItem);
}

/**
 * Event handler: When menu opens, check if menu items can be enabled for target.
 * @listens browser.menus.onShown
 * @param {Object} info
 * @param {BNodeId} info.bookmarkId
 * @returns {Promise<boolean>}
 */
export async function handleShow({ bookmarkId }) {
    if (!bookmarkId)
        return false;
    const [canStash, canUnstash] = await Promise.all([ canStashHere(bookmarkId), canUnstashThis(bookmarkId) ]);
    if (canStash) {
        browser.menus.update('stash', { enabled: true });
        // If multiple tabs selected, indicate tab count in title
        const tabs = await getSelectedTabs();
        const count = tabs.length;
        if (count > 1)
            browser.menus.update('stash', { title: stashMenuItem.title.replace('Tab', `${count} Tabs`) });
    }
    if (canUnstash)
        browser.menus.update('unstash', { enabled: true });
    if (canStash || canUnstash)
        browser.menus.refresh();
    return true; // Is handled as long as target is bookmark
}

/**
 * Event handler: When menu closes, reset menu items.
 * @listens browser.menus.onHidden
 */
export function handleHide() {
    browser.menus.update('stash', { enabled: false, title: stashMenuItem.title });
    browser.menus.update('unstash', { enabled: false });
}

/**
 * Event handler: Invoke command on target.
 * @listens browser.menus.onClicked
 * @param {Object} info
 * @param {BNodeId} [info.bookmarkId]
 * @param {string} info.menuItemId
 * @param {string} info.modifiers
 * @returns {Promise<boolean>}
 */
export async function handleClick({ bookmarkId, menuItemId, modifiers }) {
    if (!bookmarkId)
        return false;
    const remove = !modifiers.includes(STASHCOPY);
    switch (menuItemId) {
        case 'stash':
            stashMain.stashSelectedTabs(bookmarkId, remove);
            break;
        case 'unstash':
            stashMain.unstashNode(bookmarkId, remove);
            break;
    }
    return true; // Is handled as long as target is bookmark
}

/**
 * Can tabs in given or current window be stashed at/into this node?
 * @param {BNodeId} nodeId
 * @param {WindowId?} [windowId]
 * @returns {Promise<boolean>}
 */
async function canStashHere(nodeId, windowId = null) {
    /** @type {Set<WindowId | BNodeId>} */
    const nowProcessing = nowStashing.union(nowUnstashing);
    return !(
        nowProcessing.has(nodeId) || // Folder is being processed
        nowProcessing.has(windowId || await Storage.getValue('_focusedWindowId')) || // Window is being processed
        nowProcessing.has((await getNode(nodeId)).parentId) // Parent folder is being processed
    );
}
/**
 * Can given node be unstashed?
 * @param {BNodeId} nodeId
 * @returns {Promise<boolean>}
 */

async function canUnstashThis(nodeId) {
    /** @type {Set<WindowId | BNodeId>} */
    const nowProcessing = nowStashing.union(nowUnstashing);
    if (isRootId(nodeId) || nowProcessing.has(nodeId))
        return false; // Disallow root folders and folders being processed
    const node = await getNode(nodeId);
    switch (node.type) {
        case 'separator':
            return false; // Disallow separators
        case 'bookmark':
            return !nowProcessing.has(node.parentId); // Allow bookmarks, unless they are inside a folder being processed
    }
    // Is folder
    const [, protoWindow] = StashProp.Window.parse(node.title);
    if (protoWindow?.incognito && !await browser.extension.isAllowedIncognitoAccess())
        return false; // Disallow private-window folders without private-window access
    return true;
}
