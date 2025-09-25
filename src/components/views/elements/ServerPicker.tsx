/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The connect.socjsc.com Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useState } from "react";

import AccessibleButton from "./AccessibleButton";
import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import { _t } from "../../../languageHandler";
import TextWithTooltip from "./TextWithTooltip";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import ServerPickerDialog from "../dialogs/ServerPickerDialog";
import InfoDialog from "../dialogs/InfoDialog";

interface IProps {
    title?: string;
    dialogTitle?: string;
    serverConfig: ValidatedServerConfig;
    disabled?: boolean;
    onServerConfigChange?(config: ValidatedServerConfig): void;
    onLoading?(status: boolean): void;
}

const showPickerDialog = (
    title: string | undefined,
    serverConfig: ValidatedServerConfig,
    onFinished: (config?: ValidatedServerConfig) => void,
    servers: any[],
): void => {
    const { finished } = Modal.createDialog(ServerPickerDialog, { title, serverConfig, servers });
    finished.then(([config]) => onFinished(config));
};

const onHelpClick = (): void => {
    const brand = SdkConfig.get().brand;
    Modal.createDialog(
        InfoDialog,
        {
            title: _t("auth|server_picker_title_default"),
            description: _t("auth|server_picker_description", { brand }),
            button: _t("action|dismiss"),
            hasCloseButton: false,
            fixedWidth: false,
        },
        "mx_ServerPicker_helpDialog",
    );
};

const ServerPicker: React.FC<IProps> = ({ title, dialogTitle, serverConfig, onServerConfigChange, disabled, onLoading }) => {
    const disableCustomUrls = SdkConfig.get("disable_custom_urls");
    // Credentials are handled by backend proxy; no env on client
    const [servers, setServer] = useState<any>([]);

    useEffect(() => {
        onLoading?.(true);
        const onGetServers = async (): Promise<void> => {
            try {
                const res = await fetch(`/api/servers?limit=100&fields=domain,is_default&meta=filter_count`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
                const data = await res.json();
                const result = data?.data?.map((item: { domain: string, is_default: boolean }) => ({
                    "hsUrl": `https://${item.domain}`,
                    "hsName": item.domain,
                    "hsNameIsDifferent": false,
                    "isDefault": item.is_default,
                    "warning": "Identity server URL does not appear to be a valid identity server",
                    "isNameResolvable": true
                }))
                setServer(result ?? [])
                onLoading?.(false);
            } catch (e) {
                console.error("Failed to load servers", e);
                onLoading?.(false);
            }
        };
        onGetServers()

    }, [])

    let editBtn;
    if (!disableCustomUrls && onServerConfigChange && servers.length != 0) {
        const onClick = (): void => {
            showPickerDialog(dialogTitle, serverConfig, (config?: ValidatedServerConfig) => {
                if (config) {
                    onServerConfigChange(config);
                }
            }, servers);
        };
        editBtn = (
            <AccessibleButton className="mx_ServerPicker_change" kind="link" onClick={onClick} disabled={disabled}>
                {_t("action|edit")}
            </AccessibleButton>
        );
    }

    let serverName: React.ReactNode = serverConfig.isNameResolvable ? serverConfig.hsName : serverConfig.hsUrl;
    useEffect(() => {
        if (servers.length == 0) return;
        const defaultServer = servers.find((server: any) => server.isDefault);
        if (defaultServer) {
            onServerConfigChange?.(defaultServer);
        }
    }, [servers])

    if (serverConfig.hsNameIsDifferent) {
        serverName = (
            <TextWithTooltip className="mx_Login_underlinedServerName" tooltip={serverConfig.hsUrl}>
                {serverConfig.hsName}
            </TextWithTooltip>
        );
    }

    // let desc;
    // if (serverConfig.hsName === "connect.socjsc.com") {
    //     desc = <span className="mx_ServerPicker_desc">{_t("auth|server_picker_description_connect.socjsc.com")}</span>;
    // }

    return (
        <div className="mx_ServerPicker">
            <h2>{title || _t("common|homeserver")}</h2>
            {!disableCustomUrls ? (
                <AccessibleButton
                    className="mx_ServerPicker_help"
                    onClick={onHelpClick}
                    aria-label={_t("common|help")}
                />
            ) : null}
            <span className="mx_ServerPicker_server" title={typeof serverName === "string" ? serverName : undefined}>
                {servers.length != 0 ? serverName : _t("common|getting_server")}
            </span>
            {servers.length != 0 && editBtn}
            {/* {desc} */}
        </div>
    );
};

export default ServerPicker;
