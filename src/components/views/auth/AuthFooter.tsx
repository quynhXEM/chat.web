/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The connect.socjsc.com Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-SOC-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";

const AuthFooter = (): ReactElement => {
    return (
        <footer className="mx_AuthFooter" role="contentinfo">
            <a href="https://socjsc.com" style={{ cursor: "default"}} target="_blank" rel="noreferrer noopener">Copyright © <span  style={{ color: "white", cursor: "pointer" }}>SOC JSC</span></a>
        </footer>
    );
};

export default AuthFooter;
