import { hasClass } from '../utils.js';
import * as Count from './count.js';
import * as Status from './status.js';
import * as Tooltip from './tooltip.js';
import * as EditMode from './editmode.js';

const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
const $body = document.body;
export let $currentWindowRow, $otherWindowRows, $allWindowRows;

browser.runtime.sendMessage({ popup: true }).then(init);

function init(response) {
    const $currentWindow = document.getElementById('currentWindow');
    const $otherWindows = document.getElementById('otherWindows');
    const { metaWindows, currentWindowId, sortedWindowIds } = response;

    for (const windowId of sortedWindowIds) {
        const metaWindow = metaWindows[windowId];
        const $row = createRow(metaWindow);
        let $list = $otherWindows;
        if (windowId == currentWindowId) {
            $row.classList.remove('action');
            $row.classList.replace('otherRow', 'currentRow');
            $row.querySelector('.tabActions').remove();
            $row.tabIndex = -1;
            $list = $currentWindow;
        }
        $list.appendChild($row);
    }

    $currentWindowRow = $currentWindow.querySelector('li');
    $otherWindowRows = [...$otherWindows.querySelectorAll('li')];
    $allWindowRows = [$currentWindowRow, ...$otherWindowRows];

    const hasReopenTab = indicateReopenTab();
    Tooltip.generate(response.selectedTabCount, hasReopenTab);
    Count.populate();
    lockHeight($otherWindows);

    $body.addEventListener('click', onClick);
    $body.addEventListener('contextmenu', onRightClick);
    $body.addEventListener('focusin', Tooltip.show);
    $body.addEventListener('mouseover', Tooltip.show);
    $body.addEventListener('mouseleave', event => Status.show());
    $body.addEventListener('keyup', onKeyUp);
}

function createRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);

    // Add references to elements, and in each a reference to the row
    const elements = ['sendBtn', 'bringBtn', 'input', 'tabCount', 'editBtn'];
    for (const element of elements) {
        const prop = `$${element}`;
        $row[prop] = $row.querySelector(`.${element}`);
        $row[prop].$row = $row;
    }

    // Add data
    $row._id = metaWindow.id;
    $row.$input.value = metaWindow.givenName;
    $row.$input.placeholder = metaWindow.defaultName;
    if (metaWindow.incognito) $row.classList.add('private');

    return $row;
}

function indicateReopenTab() {
    const isPrivate = $row => hasClass('private', $row);
    const currentPrivate = isPrivate($currentWindowRow);
    let hasReopenTab = false;
    for (const $row of $otherWindowRows) {
        if (isPrivate($row) != currentPrivate) {
            $row.classList.add('reopenTab');
            hasReopenTab = true;
        }
    }
    return hasReopenTab;
}

function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}

function onClick(event) {
    const $target = event.target;
    if ($target.id == 'help') {
        help();
    } else
    if ($target.id == 'options') {
        options();
    } else
    if (EditMode.handleClick($target)) {
        return; // Click handled by EditMode
    } else {
        const $row = $target.closest('.otherRow');
        if ($row) callGoalAction(event, $row._id, $target);
    }
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) {
        event.preventDefault();
        return;
    }
}

function onKeyUp(event) {
    const $target = event.target;
    if (hasClass('otherRow', $target) && ['Enter', ' '].includes(event.key)) {
        callGoalAction(event, $target._id);
    }
}

export function help() {
    browser.tabs.create({ url: '/help/help.html' });
    window.close();
}

export function options() {
    browser.runtime.openOptionsPage();
    window.close();
}

export function callGoalAction(event, windowId, $target) {
    let args = [windowId, getModifiers(event)];
    if ($target) args.push(hasClass('bringBtn', $target), hasClass('sendBtn', $target));
    browser.runtime.sendMessage({ goalAction: args });
    window.close();
}

function getModifiers(event) {
    let modifiers = [];
    for (const prop in event) {
        if (prop.endsWith('Key') && event[prop]) {
            let modifier = prop[0].toUpperCase() + prop.slice(1, -3);
            modifiers.push(modifier);
        }
    }
    return modifiers;
}
