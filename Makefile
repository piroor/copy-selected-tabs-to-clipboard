NPM_MOD_DIR := $(CURDIR)/node_modules
NPM_BIN_DIR := $(NPM_MOD_DIR)/.bin

.PHONY: xpi install_dependency lint format update_extlib install_extlib

all: xpi

install_dependency:
	npm install

lint:
	$(NPM_BIN_DIR)/eslint . --ext=.js --report-unused-disable-directives

format:
	$(NPM_BIN_DIR)/eslint . --ext=.js --report-unused-disable-directives --fix

xpi: update_extlib install_extlib lint
	rm -f ./*.xpi
	zip -r -0 multipletab-we.xpi manifest.json common resources background panel options _locales extlib -x '*/.*' >/dev/null 2>/dev/null

update_extlib:
	git submodule update --init

install_extlib:
	cp submodules/webextensions-lib-event-listener-manager/EventListenerManager.js extlib/
	cp submodules/webextensions-lib-tab-id-fixer/TabIdFixer.js extlib/; echo 'export default TabIdFixer;' >> extlib/TabIdFixer.js
	cp submodules/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js extlib/; echo 'export default TabFavIconHelper;' >> extlib/TabFavIconHelper.js
	cp submodules/webextensions-lib-rich-confirm/RichConfirm.js extlib/; echo 'export default RichConfirm;' >> extlib/RichConfirm.js
	cp submodules/webextensions-lib-menu-ui/MenuUI.js extlib/; echo 'export default MenuUI;' >> extlib/MenuUI.js
	cp submodules/webextensions-lib-configs/Configs.js extlib/; echo 'export default Configs;' >> extlib/Configs.js
	cp submodules/webextensions-lib-options/Options.js extlib/; echo 'export default Options;' >> extlib/Options.js
	cp submodules/webextensions-lib-l10n/l10n.js extlib/; echo 'export default l10n;' >> extlib/l10n.js
	cp submodules/webextensions-lib-shortcut-customize-ui/ShortcutCustomizeUI.js extlib/; echo 'export default ShortcutCustomizeUI;' >> extlib/ShortcutCustomizeUI.js
