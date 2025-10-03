/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The SOC Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018, 2019 New Vector Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-SOC Connect-Commercial
Please see LICENSE files in the repository root for full details.
*/

// To ensure we load the browser-matrix version first
import "matrix-js-sdk/src/browser-index";
import React, { type ReactElement, StrictMode } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { createClient, AutoDiscovery, type ClientConfig } from "matrix-js-sdk/src/matrix";
import { WrapperLifecycle, type WrapperOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/WrapperLifecycle";

import type { QueryDict } from "matrix-js-sdk/src/utils";
import PlatformPeg from "../PlatformPeg";
import AutoDiscoveryUtils from "../utils/AutoDiscoveryUtils";
import * as Lifecycle from "../Lifecycle";
import SdkConfig, { parseSsoRedirectOptions } from "../SdkConfig";
import { type IConfigOptions } from "../IConfigOptions";
import { SnakedObject } from "../utils/SnakedObject";
import MatrixChat from "../components/structures/MatrixChat";
import { type ValidatedServerConfig } from "../utils/ValidatedServerConfig";
import { ModuleRunner } from "../modules/ModuleRunner";
import { parseQs } from "./url_utils";
import { getInitialScreenAfterLogin, getScreenFromLocation, init as initRouting, onNewScreen } from "./routing";
import { UserFriendlyError } from "../languageHandler";

window.matrixLogger = logger;

function onTokenLoginCompleted(): void {
    // if we did a token login, we're now left with the token, hs and is
    // url as query params in the url;
    // if we did an oidc authorization code flow login, we're left with the auth code and state
    // as query params in the url;
    // a little nasty but let's redirect to clear them.
    const url = new URL(window.location.href);

    url.searchParams.delete("no_universal_links");
    url.searchParams.delete("loginToken");
    url.searchParams.delete("state");
    url.searchParams.delete("code");

    window.history.replaceState(null, "", url.href);
}

export async function loadApp(fragParams: QueryDict, matrixChatRef: React.Ref<MatrixChat>): Promise<ReactElement> {
    initRouting();
    const platform = PlatformPeg.get();

    const params = parseQs(window.location);

    const urlWithoutQuery = window.location.protocol + "//" + window.location.host + window.location.pathname;
    logger.log("Vector starting at " + urlWithoutQuery);

    platform?.startUpdater();

    // Don't bother loading the app until the config is verified
    const config = await verifyServerConfig();
    const snakedConfig = new SnakedObject<IConfigOptions>(config);

    // Before we continue, let's see if we're supposed to do an SSO redirect
    const [userId] = await Lifecycle.getStoredSessionOwner();
    const hasPossibleToken = !!userId;
    const isReturningFromSso = !!params.loginToken;
    const ssoRedirects = parseSsoRedirectOptions(config);
    let autoRedirect = ssoRedirects.immediate === true;
    // XXX: This path matching is a bit brittle, but better to do it early instead of in the app code.
    const isWelcomeOrLanding =
        window.location.hash === "#/welcome" || window.location.hash === "#" || window.location.hash === "";
    const isLoginPage = window.location.hash === "#/login";

    if (!autoRedirect && ssoRedirects.on_welcome_page && isWelcomeOrLanding) {
        autoRedirect = true;
    }
    if (!autoRedirect && ssoRedirects.on_login_page && isLoginPage) {
        autoRedirect = true;
    }
    if (!hasPossibleToken && !isReturningFromSso && autoRedirect) {
        const tempCli = createClient({
            baseUrl: config.validated_server_config!.hsUrl,
            idBaseUrl: config.validated_server_config!.isUrl,
        });
        PlatformPeg.get()!.startSingleSignOn(tempCli, "sso", `/${getScreenFromLocation(window.location).screen}`);

        // We return here because startSingleSignOn() will asynchronously redirect us. We don't
        // care to wait for it, and don't want to show any UI while we wait (not even half a welcome
        // page). As such, just don't even bother loading the MatrixChat component.
        return <React.Fragment />;
    }

    const defaultDeviceName =
        snakedConfig.get("default_device_display_name") ?? platform?.getDefaultDeviceDisplayName();

    const initialScreenAfterLogin = getInitialScreenAfterLogin(window.location);

    const wrapperOpts: WrapperOpts = { Wrapper: React.Fragment };
    ModuleRunner.instance.invoke(WrapperLifecycle.Wrapper, wrapperOpts);

    return (
        <wrapperOpts.Wrapper>
            <StrictMode>
                <MatrixChat
                    ref={matrixChatRef}
                    onNewScreen={onNewScreen}
                    config={config}
                    realQueryParams={params}
                    startingFragmentQueryParams={fragParams}
                    enableGuest={!config.disable_guests}
                    onTokenLoginCompleted={onTokenLoginCompleted}
                    initialScreenAfterLogin={initialScreenAfterLogin}
                    defaultDeviceDisplayName={defaultDeviceName}
                />
            </StrictMode>
        </wrapperOpts.Wrapper>
    );
}

async function verifyServerConfig(): Promise<IConfigOptions> {
    let validatedConfig: ValidatedServerConfig;
    try {

        // Note: the query string may include is_url and hs_url - we only respect these in the
        // context of email validation. Because we don't respect them otherwise, we do not need
        // to parse or consider them here.

        // Note: Although we throw all 3 possible configuration options through a .well-known-style
        // verification, we do not care if the servers are online at this point. We do moderately
        // care if they are syntactically correct though, so we shove them through the .well-known
        // validators for that purpose.

        const config = SdkConfig.get();
        let wkConfig = config["default_server_config"]; // overwritten later under some conditions
        const serverName = config["default_server_name"];
        const hsUrl = config["default_hs_url"];
        const isUrl = config["default_is_url"];

        const incompatibleOptions = [wkConfig, serverName, hsUrl].filter((i) => !!i);
        if (hsUrl && (wkConfig || serverName)) {
            // noinspection ExceptionCaughtLocallyJS
            throw new UserFriendlyError("error|invalid_configuration_mixed_server");
        }
        if (incompatibleOptions.length < 1) {
            // noinspection ExceptionCaughtLocallyJS
            throw new UserFriendlyError("error|invalid_configuration_no_server");
        }

        if (hsUrl) {
            wkConfig = {
                "m.homeserver": {
                    base_url: hsUrl,
                },
            };
            if (isUrl) {
                wkConfig["m.identity_server"] = {
                    base_url: isUrl,
                };
            }
        }

        let discoveryResult: ClientConfig | undefined;
        if (!serverName && wkConfig) {
            discoveryResult = await AutoDiscovery.fromDiscoveryConfig(wkConfig);
        }

        if (serverName) {
            discoveryResult = await AutoDiscovery.findClientConfig(serverName);
            if (discoveryResult["m.homeserver"].base_url === null && wkConfig) {
                discoveryResult = await AutoDiscovery.fromDiscoveryConfig(wkConfig);
            }
        }



        validatedConfig = await AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult, true);
    } catch (e) {
        const { hsUrl, isUrl, userId } = await Lifecycle.getStoredSessionVars();
        if (hsUrl && userId) {
            validatedConfig = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl, isUrl, true);
        } else {
            // the user is not logged in, so scream
            throw e;
        }
    }
    validatedConfig.isDefault = true;
    const metadata = await fetch(`https://chat.socjsc.com/api/metadata`)
        .then(data => data.json())
        .then(data => data.data);

    // Helpers cập nhật thẻ trong <head>
    const upsertMeta = (key: string, content?: string, attr: "name" | "property" = "name"): void => {
        if (!content) return;
        let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
        if (!el) {
            el = document.createElement("meta");
            el.setAttribute(attr, key);
            document.head.appendChild(el);
        }
        el.setAttribute("content", String(content));
    };
    const setFavicon = (href?: string): void => {
        if (!href) return;
        let icon = document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
        if (!icon) {
            icon = document.createElement("link");
            icon.rel = "icon";
            document.head.appendChild(icon);
        }
        icon.href = href;

        let shortcut = document.head.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement | null;
        if (!shortcut) {
            shortcut = document.createElement("link");
            shortcut.rel = "shortcut icon";
            document.head.appendChild(shortcut);
        }
        shortcut.href = href;

        // Đồng bộ og:image nếu chưa có
        upsertMeta("og:image", href, "property");
    };
    const getAssetUrl = (id?: string): string | undefined => {
        if (!id) return undefined;
        return `https://soc.socjsc.com/assets/${id}`;
    };

    // Thiết lập favicon/title/description/theme-color từ metadata
    const faviconUrl = getAssetUrl(metadata?.icon_raster_webp || metadata?.icon);
    setFavicon(faviconUrl);
    if (metadata?.name) document.title = metadata.name;
    // Lấy ngôn ngữ hiện tại của trang, ưu tiên <html lang="...">
    const currentLang = (document.documentElement.getAttribute("lang") || navigator.languages?.[0] || navigator.language || metadata?.default_language || "en").toString();
    const langLc = currentLang.toLowerCase();
    const langPrefix = langLc.split("-")[0];
    const translations = Array.isArray(metadata?.translation) ? metadata.translation : [];
    const findByLang = (code?: string): any | undefined => translations.find((t: any) => String(t?.language_code || "").toLowerCase() === String(code || "").toLowerCase());
    const findByPrefix = (prefix?: string): any | undefined => translations.find((t: any) => String(t?.language_code || "").toLowerCase().split("-")[0] === String(prefix || "").toLowerCase());
    const tExact = findByLang(langLc);
    const tByPrefix = tExact ? undefined : findByPrefix(langPrefix);
    const desc: string | undefined = tExact?.description || tByPrefix?.description || metadata?.description || translations?.[0]?.description;
    if (desc) upsertMeta("description", desc);
    if (metadata?.theme_color) upsertMeta("theme-color", metadata.theme_color);

    const servers = await fetch(`https://chat.socjsc.com/api/servers`)
        .then(data => data.json())
        .then(data => data.data);
    
    const serverDefault = servers.find((server: any) => server.is_default);
    // console.log(metadata, serverDefault);
    

    SdkConfig.add({ validated_server_config: validatedConfig });
    SdkConfig.add({
        brand: metadata.name,
        room_directory: {
            servers: servers.map((server: any) => server.domain)
        },
        default_server_config: {
            "m.homeserver" : {
                base_url: `https://${serverDefault.domain}`,
                server_name: serverDefault.domain,
            }
        },
        mobile_builds: {
            android: metadata.play_store_url,
            fdroid: metadata.play_store_url,
            ios: metadata.app_store_url,
        },
        branding: {
            auth_header_logo_url: getAssetUrl(metadata.icon_raster_webp),
        },
        default_theme: metadata.theme_color,
        default_country_code: metadata.default_language,
    });
    
    return SdkConfig.get();
}
