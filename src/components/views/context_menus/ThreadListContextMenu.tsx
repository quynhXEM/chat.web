/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The SOC Connect Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-SOC Connect-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type ButtonEvent } from "../elements/AccessibleButton";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { copyPlaintext } from "../../../utils/strings";
import { ChevronFace, ContextMenuTooltipButton, type MenuProps, useContextMenu } from "../../structures/ContextMenu";
import { _t } from "../../../languageHandler";
import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from "./IconizedContextMenu";
import { WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import Modal from "../../../Modal";
import BaseDialog from "../dialogs/BaseDialog";
import DialogButtons from "../elements/DialogButtons";

export interface ThreadListContextMenuProps {
    mxEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    onMenuToggle?: (open: boolean) => void;
}

const contextMenuBelow = (elementRect: DOMRect): MenuProps => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.scrollX + elementRect.width;
    const top = elementRect.bottom + window.scrollY;
    const chevronFace = ChevronFace.None;
    return { left, top, chevronFace };
};

const ThreadListContextMenu: React.FC<ThreadListContextMenuProps> = ({
    mxEvent,
    permalinkCreator,
    onMenuToggle,
    ...props
}) => {
    const [menuDisplayed, button, openMenu, closeThreadOptions] = useContextMenu();

    const viewInRoom = useCallback(
        (evt: ButtonEvent): void => {
            evt.preventDefault();
            evt.stopPropagation();
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                event_id: mxEvent.getId(),
                highlighted: true,
                room_id: mxEvent.getRoomId(),
                metricsTrigger: undefined, // room doesn't change
            });
            closeThreadOptions();
        },
        [mxEvent, closeThreadOptions],
    );

    const copyLinkToThread = useCallback(
        async (evt: ButtonEvent | undefined): Promise<void> => {
            if (permalinkCreator) {
                evt?.preventDefault();
                evt?.stopPropagation();
                const matrixToUrl = permalinkCreator.forEvent(mxEvent.getId()!);
                await copyPlaintext(matrixToUrl);
                closeThreadOptions();
            }
        },
        [mxEvent, closeThreadOptions, permalinkCreator],
    );

    // Remove Threads
    const removeThread = useCallback(
        async (evt: ButtonEvent | undefined): Promise<void> => {
            if (permalinkCreator) {
                evt?.preventDefault();
                evt?.stopPropagation();
                const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
                if (!room) return closeThreadOptions();
                const eventId = mxEvent.getId();
                if (!eventId) return closeThreadOptions();
                const thread = room.getThread(eventId);
                if (thread) {
                    Modal.createDialog(BaseDialog, {
                        title: `${_t("timeline|mab|remove_thread")} ${_t("common|threads")}`,
                        className: "mx_ConfirmDeleteThreadDialog",
                        contentId: "mx_ConfirmDeleteThreadDialog_content",
                        children: (
                            <div>
                                <p>{_t("timeline|mab|action_no_disable")}</p>
                                <DialogButtons
                                    primaryButton={_t("timeline|mab|remove_thread")}
                                    onPrimaryButtonClick={async () => {
                                        // Lấy tất cả event con (không bao gồm event gốc)
                                        const childEvents = thread.events.filter(ev => ev.getId() && ev.getId() !== mxEvent.getId());
                                        const cli = MatrixClientPeg.safeGet();
                                        const roomId = room.roomId;
                                        if (!roomId) return closeThreadOptions();
                                        // Xóa tất cả event con
                                        await Promise.all(childEvents.map(ev => cli.redactEvent(roomId, ev.getId()!)));
                                        // Đóng panel threads
                                        RightPanelStore.instance.hide(roomId);
                                        Modal.closeCurrentModal();
                                        const eventId = mxEvent.getId();
                                        if (eventId) {
                                            await cli.redactEvent(roomId, eventId);
                                        }
                                    }}
                                    cancelButton={_t("action|cancel")} 
                                    onCancel={() => Modal.closeCurrentModal()}
                                />
                            </div>
                        ),
                        hasCancel: true,
                    });
                } else {
                    closeThreadOptions();
                }
            }
        },
        [mxEvent, closeThreadOptions, permalinkCreator],
    );

    useEffect(() => {
        onMenuToggle?.(menuDisplayed);
    }, [menuDisplayed, onMenuToggle]);

    const room = MatrixClientPeg.safeGet().getRoom(mxEvent.getRoomId());
    const isMainSplitTimelineShown = !!room && !WidgetLayoutStore.instance.hasMaximisedWidget(room);
    return (
        <React.Fragment>
            <ContextMenuTooltipButton
                {...props}
                className="mx_BaseCard_header_title_button--option"
                onClick={openMenu}
                title={_t("right_panel|thread_list|context_menu_label")}
                isExpanded={menuDisplayed}
                ref={button}
                data-testid="threadlist-dropdown-button"
            />
            {menuDisplayed && (
                <IconizedContextMenu
                    onFinished={closeThreadOptions}
                    className="mx_RoomTile_contextMenu"
                    compact
                    rightAligned
                    {...contextMenuBelow(button.current!.getBoundingClientRect())}
                >
                    <IconizedContextMenuOptionList>
                        {isMainSplitTimelineShown && (
                            <IconizedContextMenuOption
                                onClick={(e) => viewInRoom(e)}
                                label={_t("timeline|mab|view_in_room")}
                                iconClassName="mx_ThreadPanel_viewInRoom"
                            />
                        )}
                        {permalinkCreator && (
                            <IconizedContextMenuOption
                                data-testid="copy-thread-link"
                                onClick={(e) => copyLinkToThread(e)}
                                label={_t("timeline|mab|copy_link_thread")}
                                iconClassName="mx_ThreadPanel_copyLinkToThread"
                            />
                        )}
                        <IconizedContextMenuOption
                            className="mx_IconizedContextMenu_itemDestructive"
                            data-testid="remove-thread"
                            onClick={(e) => removeThread(e)}
                            label={_t("timeline|mab|remove_thread")}
                            iconClassName="mx_ThreadPanel_removeThread"
                        />
                    </IconizedContextMenuOptionList>
                </IconizedContextMenu>
            )}
        </React.Fragment>
    );
};

export default ThreadListContextMenu;
