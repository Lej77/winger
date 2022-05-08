import * as Settings from '../background/settings.js';
import * as Theme from '../theme.js';
import { getShortcut, GroupMap } from '../utils.js';
import { validify } from '../background/name.js';
import { openHelp } from '../background/action.js';

const $body = document.body;
const $form = $body.querySelector('form');
const $settingFields = [...$form.querySelectorAll('.setting')];
const stash_subSymbol = $form.stash_home.options[1].text.slice(-1);
const enablerMap = new GroupMap(); // Fields that enable/disable other fields

(async function init() {
    const SETTINGS = await browser.runtime.sendMessage({ settings: true });
    Theme.apply(SETTINGS.theme);
    for (const $field of $settingFields) {
        loadSetting($field);
        registerEnabler($field);
    }
    stash_updateHomeSelect();
    staticText_insertShortcut();
    staticText_checkPrivateAccess();
    $form.onchange = onFieldChange;
    $form.onclick = onElClick;
    $form.onsubmit = saveSettings;

    //@ (Object), state -> state
    function loadSetting($field) {
        const value = SETTINGS[$field.name];
        const type = $field.type;
        if (type === 'radio') {
            $field.checked = $field.value === value;
        } else {
            $field[type === 'checkbox' ? 'checked' : 'value'] = value;
        }
    }

    //@ (Object), state -> state
    function registerEnabler($field) {
        const $enabler = $form[$field.dataset.enabledBy];
        if ($enabler) {
            enablerMap.group($field, $enabler);
            updateEnablerTarget($field, $enabler.disabled || !$enabler.checked);
        }
    }
})();

//@ ({ Object }), state -> state
async function onFieldChange({ target: $field }) {
    await stash_onChecked($field);
    stash_updateHomeSelect();
    activateEnabler($field);
}

//@ ({ Object }), state -> state|null
function onElClick({ target: $el }) {
    if ($el.classList.contains('help'))
        openHelp($el.getAttribute('href'));
}

//@ state -> state
function saveSettings() {
    const newSettings = {};
    for (const $field of $settingFields) {
        const type = $field.type;
        if (type === 'radio') {
            if ($field.checked) {
                newSettings[$field.name] = $field.value;
            }
        } else {
            newSettings[$field.name] = $field[type === 'checkbox' ? 'checked' : 'value'];
        }
    }
    Settings.set(newSettings);
    browser.runtime.reload();
}

// Enable/disable fields that $enabler controls.
//@ (Object), state -> state|null
function activateEnabler($enabler) {
    const $targets = enablerMap.get($enabler);
    if (!$targets) return;
    const disable = $enabler.disabled || !$enabler.checked; // Disable targets if enabler is unchecked or is itself disabled
    for (const $target of $targets) {
        updateEnablerTarget($target, disable);
        activateEnabler($target); // In case $target is itself an enabler
    }
}

//@ (Object, Boolean) -> state
function updateEnablerTarget($field, disable) {
    $field.disabled = disable;
    $field.closest('label')?.classList.toggle('muted', disable);
}

//@ (Object), state -> state|null
async function stash_onChecked($field) {
    if ($field !== $form.enable_stash) return;
    const permission = { permissions: ['bookmarks'] };
    if (!$field.checked) return browser.permissions.remove(permission);
    $field.checked = await browser.permissions.request(permission);
}

// Add/update subfolder name in the stash home <select>.
//@ state -> state
function stash_updateHomeSelect() {
    const name = validify($form.stash_home_name.value);
    $form.stash_home_name.value = name;
    for (const $option of $form.stash_home.options)
        if (!$option.value.endsWith('_'))
            $option.text = `${$option.previousElementSibling.text} ${stash_subSymbol} ${name}`;
}

//@ state -> state
async function staticText_insertShortcut() {
    const defaultShortcut = browser.runtime.getManifest().commands._execute_browser_action.suggested_key.default;
    const currentShortcut = await getShortcut();
    if (currentShortcut) $body.querySelector('.current-shortcut').textContent = currentShortcut;
    if (currentShortcut == defaultShortcut) return;
    const $defaultShortcutText = $body.querySelector('.default-shortcut-text');
    $defaultShortcutText.querySelector('.default-shortcut').textContent = defaultShortcut;
    $defaultShortcutText.hidden = false;
}

//@ state -> state
async function staticText_checkPrivateAccess() {
    const isAllowed = await browser.extension.isAllowedIncognitoAccess();
    const $toShow = $body.querySelectorAll(`.private-allowed-${isAllowed ? 'yes' : 'no'}`);
    $toShow.forEach($el => $el.hidden = false);
}