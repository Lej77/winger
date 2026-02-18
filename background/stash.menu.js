import { getNode, isRootId, nowStashing, nowUnstashing } from './stash.core.js';
import * as stashMain from './stash.main.js';
import * as StashProp from './stash.prop.js';

import { getSelectedTabs } from './action.js';

import { STASHCOPY } from '../modifier.js';
import * as Storage from '../storage.js';

/** @import { WindowId, BNodeId, BNode } from '../types.js' */

const contexts = ['bookmark']; // Menu only appears if bookmarks permission granted
const parentId = 'bookmark';
const menuItemBase = { contexts, parentId, enabled: false }; // Start out disabled
const stashMenuItem = { ...menuItemBase, id: 'stash', title: '&Send Tab Here', icons: { 16: 'icons/send.svg' } };
const unstashMenuItem = { ...menuItemBase, id: 'unstash', title: '&Unstash Bookmark', icons: { 16: 'icons/unstash.svg' } };

export function init() {
    browser.menus.create({ contexts, id: parentId, title: '&Winger' });
    browser.menus.create(stashMenuItem);
    browser.menus.create({ ...menuItemBase, id: 'stashMenuSeparator', type: 'separator' });
    browser.menus.create(unstashMenuItem);
}

/**
 * Event handler: When menu opens, check if menu items can be enabled for target.
 * Return `true` if target is a bookmark and therefore is handled.
 * @listens browser.menus.onShown
 * @param {Object} info
 * @param {BNodeId} info.bookmarkId
 * @returns {Promise<boolean>}
 */
export async function handleShow({ bookmarkId }) {
    if (!bookmarkId)
        return false;

    const [canStash, canUnstash, isFolder] = await examineNode(bookmarkId);
    if (canStash) {
        browser.menus.update('stash', { enabled: true });
        const count = (await getSelectedTabs()).length;
        if (count > 1)
            browser.menus.update('stash', { title: stashMenuItem.title.replace('Tab', `${count} Tabs`) }); // Indicate count in title if multiple tabs selected
    }
    if (canUnstash)
        browser.menus.update('unstash', { enabled: true });
    if (isFolder)
        browser.menus.update('unstash', { title: unstashMenuItem.title.replace('Bookmark', 'Folder') });
    if (canStash || canUnstash || isFolder)
        browser.menus.refresh();

    return true;
}

/**
 * @param {BNodeId} nodeId
 * @returns {Promise<[canStash: boolean, canUnstash: boolean, isFolder: boolean]>}
 */
async function examineNode(nodeId) {
    /**
     * Windows and nodes currently undergoing a stash or unstash operation.
     * @type {Set<WindowId | BNodeId>}
     */
    const nowProcessing = nowStashing.union(nowUnstashing);
    const node = await getNode(nodeId);
    const isFolder = node.type === 'folder';

    if (nowProcessing.has(nodeId))
        return [false, false, isFolder]; // Disallow if node is being processed

    const isParentProcessing = nowProcessing.has(node.parentId);

    /**
     * Can tabs in current window be stashed at/into this node?
     * @returns {Promise<boolean>}
     */
    async function canStashHere() {
        if (nowProcessing.has(await Storage.getValue('_focusedWindowId')))
            return false; // Disallow if current window is being processed
        return !isParentProcessing; // Allow node, unless it's inside a folder being processed
    }
    /**
     * Can this node be unstashed?
     * @returns {Promise<boolean>}
     */
    async function canUnstashThis() {
        if (isRootId(nodeId))
            return false; // Disallow root folder
        if (isFolder) {
            const [, protoWindow] = StashProp.Window.parse(node.title);
            const isPrivateWithoutAccess = protoWindow?.incognito && !await browser.extension.isAllowedIncognitoAccess();
            return !isPrivateWithoutAccess; // Allow folder, unless it's a private-window folder without private-window access
        }
        if (node.type === 'bookmark')
            return !isParentProcessing; // Allow bookmark, unless it's inside a folder being processed
        return false;
    }

    return Promise.all([ canStashHere(), canUnstashThis(), isFolder ]);
}



/**
 * Event handler: When menu closes, reset menu items.
 * @listens browser.menus.onHidden
 */
export function handleHide() {
    browser.menus.update('stash', { enabled: false, title: stashMenuItem.title });
    browser.menus.update('unstash', { enabled: false, title: unstashMenuItem.title });
}

/**
 * Event handler: Invoke command on target.
 * Return `true` if target is a bookmark and therefore is handled.
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
    return true;
}
