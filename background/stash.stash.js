import { createNode, FolderList, getNode, homeId, isFolder, nowStashing } from './stash.core.js';
import * as StashProp from './stash.prop.js';
import { deplaceholderize } from './action.auto.js';

/** @import { WindowId, BNodeId, Window, Tab, BNode } from '../types.js' */

/**
 * Turn window/tabs into folder/bookmarks.
 * Create folder if nonexistent, save tabs as bookmarks in folder. Close window if remove is true.
 * @param {WindowId} windowId
 * @param {string} name
 * @param {boolean} remove
 */
export async function stashWindow(windowId, name, remove) {
    console.info(`Stashing window id ${windowId}: ${name}...`);
    nowStashing.add(windowId);

    /** @type {[Window, Window[]?, FolderList]} */
    const [window, allWindows, folderList] = await Promise.all([
        browser.windows.get(windowId, { populate: true }),
        remove && browser.windows.getAll(),
        (new FolderList()).populate(await homeId),
    ]);

    name = StashProp.Window.stringify(name, window);
    const folder = await folderList.findBookmarklessByTitle(name) || await folderList.addNew(name);

    await runStashTasks({ window, node: folder, remove, allWindows });

    nowStashing.delete(windowId);
    console.info(`...Done stashing window id ${windowId} to node id ${folder.id}: ${name}`);
}

/**
 * Turn current window's selected tabs into bookmarks at targeted bookmark location or in targeted folder.
 * Close tabs if remove is true.
 * @param {BNodeId} nodeId
 * @param {boolean} remove
 */
export async function stashSelectedTabs(nodeId, remove) {
    console.info(`Stashing tabs to node id ${nodeId}...`);
    /** @type {[Tab[], BNode]} */
    const [tabs, node] = await Promise.all([
        browser.tabs.query({ currentWindow: true }),
        getNode(nodeId),
    ]);

    const windowId = tabs[0].windowId;
    nowStashing.add(windowId);

    const selectedTabs = tabs.filter(tab => tab.highlighted);
    delete selectedTabs.find(tab => tab.active)?.active; // Avoid adding extra "active tab" to target stashed window

    /** Defined if all tabs in window will be closed. @type {Window[]?} */
    const allWindows = remove && (selectedTabs.length === tabs.length) &&
        await browser.windows.getAll();

    await runStashTasks({ tabs: selectedTabs, node, remove, allWindows });

    nowStashing.delete(windowId);
    console.info(`...Done stashing tabs to node id ${nodeId}`);
}

/**
 * @param {Object} info
 * @param {Window} [info.window] - Required if stashing window. Must contain its own `window.tabs` property.
 * @param {Tab[]} [info.tabs] - Required if stashing only tabs.
 * @param {BNode} info.node - Destination node.
 * @param {boolean} info.remove
 * @param {Window[]} [info.allWindows] - Required if `remove` is true and removing will result in closing a window.
 */
async function runStashTasks({ window, tabs, node, remove, allWindows }) {
    /** @type {(() => Promise<void>)?} */
    let runRemoveTasks;
    tabs ??= window.tabs;
    await StashProp.Tab.prepare(tabs);

    if (remove) {
        const windowId = tabs[0].windowId;

        runRemoveTasks = async () => {
            const tabIds = tabs.map(tab => tab.id);
            await browser.tabs.ungroup(tabIds); // Prevent Firefox saving closed groups
            window
                ? browser.windows.remove(windowId)
                : browser.tabs.remove(tabIds);
        };

        // If window is alone: minimize for immediate visual feedback, close later after all bookmarks created
        if (allWindows?.length === 1) {
            browser.windows.update(windowId, { state: 'minimized' });
        } else {
            runRemoveTasks(); // Normal immediate removal of window/tabs
            runRemoveTasks = null;
        }
    }

    await createBookmarksAtNode(tabs, node);
    runRemoveTasks?.(); // Delayed removal of lone window
}

/**
 * @param {Tab[]} tabs
 * @param {BNode} node
 * @returns {Promise<BNode[]>}
 */
async function createBookmarksAtNode(tabs, node) {
    const isNodeFolder = isFolder(node);
    const folder = isNodeFolder ? node : await getNode(node.parentId);
    const folderId = folder.id;
    nowStashing.add(folderId);

    const count = tabs.length;
    const index = isNodeFolder ? null : node.index;
    /** @type {Promise<BNode>[]} */
    const creatingBookmarks = new Array(count);
    for (let i = count; i--;) // Reverse iteration necessary for bookmarks to be in correct order
        creatingBookmarks[i] = createBookmark(tabs[i], folderId, index);
    const bookmarks = await Promise.all(creatingBookmarks);

    nowStashing.delete(folderId);
    return bookmarks;
}

/**
 * @param {Tab} tab
 * @param {BNodeId} parentId
 * @param {number?} index
 * @returns {Promise<BNode>}
 */
async function createBookmark(tab, parentId, index) {
    const url = deplaceholderize(tab.url);
    const title = StashProp.Tab.stringify(tab, parentId) || url;
    const bookmark = await createNode({ parentId, url, title, index });
    console.info(`Stashed bookmark id ${bookmark.id}: ${url} | ${title}`);
    return bookmark;
}
