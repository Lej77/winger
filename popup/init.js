import {
    $body,
    $currentWindowRow,
    $omnibox,
    $otherWindowsList,
    $otherWindowRows,
    $names,
    $toolbar,
    $status,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as Filter from './filter.js';
import * as Status from './status.js';
import * as Request from './request.js';

Request.popup().then(onSuccess).catch(onError);

//@ ({ Object, [Object], Object }) -> state
function onSuccess({ currentWinfo, otherWinfos, settings, allowedPrivate }) {
    markReopen(otherWinfos, currentWinfo.incognito);
    populate(currentWinfo, otherWinfos, settings);
    $names.push(...$body.querySelectorAll('.name'));

    Omnibox.init(settings, allowedPrivate);
    Status.init(currentWinfo, otherWinfos, settings);
    Filter.init();
    indicateReopenTabs();
    lockHeight($otherWindowsList);
}

//@ -> state
function onError() {
    Request.debug();
    Request.showWarningBadge();

    $currentWindowRow.hidden = true;
    $omnibox.hidden = true;
    $otherWindowsList.hidden = true;

    $status.textContent = 'Close and try again. If issue persists, restart Winger.';
    $toolbar.querySelectorAll('button').forEach($button => $button.remove());
    const $restartBtn = document.getElementById('restartTemplate').content.firstElementChild;
    $toolbar.appendChild($restartBtn);
    $restartBtn.onclick = () => browser.runtime.reload();
    $restartBtn.focus();
}


// Add reopen property to other-winfos that do not share the same private status as the current-winfo.
// Indicates that a send/bring action to the other-window will be a reopen operation.
//@ ([Object], Boolean) -> state
function markReopen(otherWinfos, isCurrentIncognito) {
    for (const winfo of otherWinfos)
        winfo.reopen = winfo.incognito !== isCurrentIncognito;
}

// Populate $otherWindowsList and $otherWindowRows with rows
//@ (Object, [Object], Object) -> state
function populate(currentWinfo, otherWinfos, settings) {
    Row.initCurrent(settings);
    const $rowsFragment = document.createDocumentFragment();
    let $minHeading = $otherWindowsList.firstElementChild; // "---Minimized---"
    let minHeadingIndex = -1, index = 0;
    // Create other-rows (by cloning current-row), and set minHeadingIndex to index of first minimized row
    for (const winfo of otherWinfos) {
        if (minHeadingIndex === -1 && winfo.minimized)
            minHeadingIndex = index;
        $rowsFragment.appendChild(Row.createOther(winfo));
        index++;
    }
    $otherWindowsList.appendChild($rowsFragment);
    // Hydrate current-row only after all other-rows have been created
    Row.hydrateCurrent($currentWindowRow, currentWinfo);

    // Populate $otherWindowRows
    if (minHeadingIndex === -1) {
        $minHeading.remove();
        $otherWindowRows.$minHeading = {};
    } else {
        const $elAfterHeading = minHeadingIndex
            ? $otherWindowsList.querySelector('.minimized') // Move to above the first minimized-row
            : $otherWindowsList; // Move outside and above the list
        $elAfterHeading.insertAdjacentElement('beforebegin', $minHeading);
        $otherWindowRows.$minHeading = $minHeading;
        $minHeading.hidden = false;
    }
    const $otherRows = [...$otherWindowsList.children];
    $otherWindowRows.$withMinHeading = [...$otherRows]; // Has no minimized-heading if minHeadingIndex <= 0
    if (minHeadingIndex > 0)
        $otherRows.splice(minHeadingIndex, 1);
    $otherWindowRows.push(...$otherRows); // Always has no minimized-heading
}

const Row = {

    CELL_SELECTORS: new Set(['.send', '.bring', '.name', '.tabCount']),

    //@ (Object) -> state
    initCurrent(settings) {
        // Remove any toggled-off buttons
        const buttons = [
            ['show_popup_bring', '.bring'],
            ['show_popup_send', '.send'],
        ];
        let buttonCount = buttons.length;
        for (const [setting, selector] of buttons) {
            const $button = $currentWindowRow.querySelector(selector);
            if (settings[setting]) {
                $button.hidden = false;
            } else {
                $button.remove();
                Row.CELL_SELECTORS.delete(selector);
                buttonCount--;
            }
        }
        if (buttonCount)
            document.documentElement.style.setProperty('--button-count', buttonCount);
    },

    //@ (Object) -> (Object)
    createOther(winfo) {
        const $row = $currentWindowRow.cloneNode(true);
        Row.hydrate($row, winfo);
        // Disable tab action buttons if popup/panel-type window
        if (winfo.type !== 'normal') {
            $row.querySelectorAll('.tabAction').forEach(Row.disableElement);
            $row.classList.add('tabless');
        }
        return $row;
    },

    //@ (Object, Object) -> state
    hydrateCurrent($row, winfo) {
        Row.hydrate($row, winfo);
        Row.disableElement($row);
        $row.querySelectorAll('.tabAction').forEach(Row.disableElement);
        $row.$name.tabIndex = 0;
    },

    //@ (Object, { Number, Boolean, Boolean, String, Number }) -> state
    hydrate($row, { givenName, id, incognito, minimized, tabCount, titleSansName }) {
        // Add references to row's cells, and in each cell a reference back to the row
        for (const selector of Row.CELL_SELECTORS) {
            const $cell = $row.querySelector(selector);
            const reference = selector.replace('.', '$');
            $cell.$row = $row;
            $row[reference] = $cell;
        }
        // Add data
        $row._id = id;
        $row.$name._id = id;
        $row.$name.value = givenName;
        $row.$name.placeholder = titleSansName;
        $row.$tabCount.textContent = tabCount;
        $row.classList.toggle('minimized', minimized);
        $row.classList.toggle('private', incognito);
    },

    //@ (Object) -> state
    disableElement($el) {
        $el.disabled = true;
        $el.tabIndex = -1;
        $el.removeAttribute('data-action');
    },

}

const isPrivate = $row => $row.classList.contains('private'); //@ (Object) -> (Boolean)

//@ state -> state
function indicateReopenTabs() {
    const currentIsPrivate = isPrivate($currentWindowRow);
    for (const $row of $otherWindowRows)
        if (isPrivate($row) != currentIsPrivate)
            $row.classList.add('reopenTabs');
}

//@ (Object) -> state
function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}
