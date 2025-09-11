import {
    FLAGS,
    $body,
    $currentWindowRow,
    $otherWindowsList,
    $otherWindowRows,
    $names,
} from './common.js';
import * as Filter from './filter.js';
import * as Request from './request.js';

/** @import { NameField$, WindowRow$ } from './common.js' */
/** @import { Winfo, BNode, StashFolder } from '../types.js' */

const CELL_SELECTORS = new Set(['.send', '.bring', '.icon', '.name', '.tabCount', '.stash']);

/** Base window/folder rows to clone. @type {Object<string, WindowRow$>} */
const Template = {};

/**
 * @param {Winfo} fgWinfo
 * @param {Winfo[]} bgWinfos
 */
export function addWindows(fgWinfo, bgWinfos) {
    WindowRow.init();
    const currentIncognito = fgWinfo.incognito;
    /** @type {HTMLElement} */ const $headingMinimized = $otherWindowsList.querySelector('window-heading.minimized');
    /** @type {WindowRow$[]} */ const $rows = [];
    /** @type {NameField$[]} */const $_names = [];
    const $rowsFragment = document.createDocumentFragment();

    // Create other-rows (by cloning current-row)
    for (const winfo of bgWinfos) {
        /** @type {WindowRow$} */ const $row = WindowRow.create(winfo, currentIncognito);
        $rows.push($row);
        $_names.push($row.$name);
        $rowsFragment.appendChild($row);
    }
    $otherWindowsList.appendChild($rowsFragment);

    // Hydrate current-row only after all other-rows have been created
    WindowRow.hydrateCurrent($currentWindowRow, fgWinfo);

    // Position minimized-heading
    /** @type {WindowRow$?} */ const $firstMinimizedRow = $otherWindowsList.querySelector('window-row.minimized');
    $firstMinimizedRow ?
        $firstMinimizedRow.insertAdjacentElement('beforebegin', $headingMinimized) :
        $otherWindowsList.appendChild($headingMinimized);

    // Hydrate globals
    $otherWindowRows.$headingMinimized = $headingMinimized;
    $otherWindowRows.$withHeadings = [...$otherWindowsList.children];
    $otherWindowRows.push(...$rows);
    Filter.$shownRows.push(...$rows);
    $names.push($currentWindowRow.$name, ...$_names);
}

const WindowRow = {
    init() {
        // Remove any toggled-off buttons
        const buttons = [
            ['show_popup_bring', '.bring'],
            ['show_popup_send', '.send'],
            ['show_popup_stash', '.stash'],
        ];
        let buttonCount = buttons.length;
        for (const [setting, selector] of buttons) {
            /** @type {HTMLButtonElement} */ const $button = $currentWindowRow.querySelector(selector);
            if (FLAGS[setting]) {
                $button.hidden = false;
            } else {
                $button.remove();
                CELL_SELECTORS.delete(selector);
                buttonCount--;
            }
        }
        if (buttonCount)
            document.documentElement.style.setProperty('--popup-row-button-count', buttonCount);

        Template.$window = $currentWindowRow.cloneNode(true);
        Template.$window.removeAttribute('id');
    },

    /**
     * @param {Winfo} winfo
     * @param {boolean} currentIncognito
     * @returns {WindowRow$}
     */
    create(winfo, currentIncognito) {
        /** @type {WindowRow$} */ const $row = Template.$window.cloneNode(true);
        WindowRow._hydrate($row, winfo);
        // Disable action buttons if popup/panel-type window
        if (winfo.type !== 'normal') {
            $row.querySelectorAll('button').forEach(disableElement);
            $row.classList.add('tabless');
        } else
        // Indicate if a send/bring action to this window will be a reopen operation
        if (winfo.incognito != currentIncognito)
            $row.classList.add('reopenTabs');
        return $row;
    },

    /**
     * @param {WindowRow$} $row
     * @param {Winfo} winfo
     */
    hydrateCurrent($row, winfo) {
        WindowRow._hydrate($row, winfo);
        disableElement($row);
        $row.querySelectorAll('.tabAction').forEach(disableElement);
        $row.$name.tabIndex = 0;
        $row.$name.title = '';
    },

    /**
     * @param {WindowRow$} $row
     * @param {Winfo} winfo
     */
    _hydrate($row, { givenName, id, incognito, minimized, tabCount, title, titleSansName }) {
        hydrateCellReferences($row);
        title = titleSansName || title || '';
        // Add data
        $row._id = id;
        $row.setAttribute('aria-labelledby', id);
        $row.$name.id = id; // For aria-labelledby
        $row.$name._id = id;
        $row.$name.value = givenName;
        $row.$name.placeholder = title;
        $row.$name.title = title;
        $row.$tabCount.textContent = tabCount;
        $row.classList.toggle('minimized', minimized);
        $row.classList.toggle('private', incognito);
    },
};

/**
 * @param {BNode[]} folders
 */
export function addFolders(folders) {
    // Create stashed-heading
    /** @type {HTMLElement} */ const $headingStashed = $otherWindowRows.$headingMinimized.cloneNode(true);
    $headingStashed.classList.replace('minimized', 'stashed');
    $headingStashed.dataset.title = 'Stashed';
    $otherWindowsList.appendChild($headingStashed);

    // Create stashed-rows
    FolderRow.init();
    /** @type {WindowRow$[]} */ const $rows = [];
    /** @type {NameField$[]} */ const $_names = [];
    const $rowsFragment = document.createDocumentFragment();
    for (let folder of folders) {
        const $row = FolderRow.create(folder);
        $rows.push($row);
        $_names.push($row.$name);
        $rowsFragment.appendChild($row);
        folder = { id: folder.id }; // Strip down folder objects for `Request.popupStashedSizes()`
    }
    $otherWindowsList.appendChild($rowsFragment);

    // Hydrate globals
    $otherWindowRows.$headingStashed = $headingStashed;
    $otherWindowRows.$stashed = $rows;
    $otherWindowRows.$stashed._startIndex = $otherWindowRows.length;
    $names.$stashed = $_names;
    $names.$stashed._startIndex = $names.length;

    // Hydrate tab counts
    Request.popupStashedSizes(folders).then(folders =>
        folders.forEach((folder, i) => $rows[i].$tabCount.textContent = folder.bookmarkCount)
    );
}

/**
 * @param {Object} [config]
 * @param {boolean} [config.scrollIntoView]
 */
export function toggleViewFolders({ scrollIntoView } = {}) {
    // Stashed-rows visibility governed by popup.css
    if ($body.classList.toggle('viewstash')) {
        const $rows = $otherWindowRows.$stashed;
        $otherWindowRows.push(...$rows);
        $otherWindowRows.$withHeadings.push($otherWindowRows.$headingStashed, ...$rows);
        Filter.$shownRows.push(...$rows);
        $names.push(...$names.$stashed);
        if (scrollIntoView)
            $otherWindowRows.$headingStashed.previousElementSibling?.scrollIntoView({ behavior: 'smooth' });
    } else {
        const rowIndex = $otherWindowRows.$stashed._startIndex;
        $otherWindowRows.splice(rowIndex);
        $otherWindowRows.$withHeadings.splice(rowIndex + 1); // +1 to account for `$headingMinimized`
        Filter.$shownRows.splice(rowIndex);
        $names.splice($names.$stashed._startIndex);
    }
}

const FolderRow = {
    init() {
        Template.$folder = Template.$window.cloneNode(true);
        Template.$folder.querySelector('.name').placeholder = '(no title)';
        if (CELL_SELECTORS.delete('.bring'))
            disableElement(Template.$folder.querySelector('.bring'));
        if (CELL_SELECTORS.has('.stash'))
            Template.$folder.querySelector('.stash').title = 'Unstash';
        if ($body.classList.contains('filtered'))
            Template.$folder.hidden = true;
    },

    /**
     * @param {StashFolder}
     * @returns {WindowRow$}
     */
    create({ givenName, id, protoWindow }) {
        /** @type {WindowRow$} */ const $row = Template.$folder.cloneNode(true);
        hydrateCellReferences($row);
        $row._id = id;
        $row.setAttribute('aria-labelledby', id);
        $row.$name.id = id; // For aria-labelledby
        $row.$name._id = id;
        $row.$name.value = givenName;
        $row.classList.add('stashed');
        $row.classList.toggle('private', protoWindow?.incognito ?? false);
        return $row;
    },

};

/**
 * Add references to row's cells, and in each cell a reference back to the row.
 * @param {WindowRow$} $row
 */
function hydrateCellReferences($row) {
    for (const selector of CELL_SELECTORS) {
        /** @type {HTMLElement & { $row: WindowRow$ }} */
        const $cell = $row.querySelector(selector);
        const reference = selector.replace('.', '$');
        $cell.$row = $row;
        $row[reference] = $cell;
    }
}

/**
 * @param {HTMLElement} $el
 */
function disableElement($el) {
    $el.disabled = true;
    $el.tabIndex = -1;
}
