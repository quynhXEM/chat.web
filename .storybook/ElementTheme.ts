/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-SOC-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { create } from "storybook/theming";

export default create({
    base: "dark",

    // Colors
    textColor: "#1b1d22",
    colorSecondary: "#111111",

    // UI
    appBg: "#ffffff",
    appContentBg: "#ffffff",

    // Toolbar
    barBg: "#ffffff",

    brandTitle: "Chat Web Connect",
    brandUrl: "https://www.nobody.network/",
    brandImage: "https://www.nobody.network/default/theme/assets-custom/img/nobody-icon-darkmode.png?height=44",
    brandTarget: "_self",
});
