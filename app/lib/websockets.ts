import { List } from "../models/List.ts";
import { NewPostsNotification } from "../views/components/PostFeed.tsx";

// A map of list hashIds to a set of WebSocket clients
// (one hashId can have multiple clients connected to it)
export const wsClientsMap = new Map<string, Set<WebSocket>>();

// Receives an array of sets of WebSocket clients and broadcasts a new post
// to each client in each set (because one post can be associated with multiple lists
// and one list can have multiple clients connected to it)
export function broadcastNewPost(
    lists: List[],
) {
    lists.forEach((list) => {
        const wsClientsSet = wsClientsMap.get(list.hashId);
        if (!wsClientsSet) {
            return;
        }
        console.log(`[WS] Broadcasting to ${wsClientsSet.size} clients`);
        wsClientsSet.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(
                        NewPostsNotification({ list, display: true })
                            .toString(),
                    );
                } catch (error) {
                    console.error("[WS] Failed to send message:", error);
                    wsClientsSet.delete(ws);
                }
            } else {
                console.log(
                    `[WS] Removing client with readyState: ${ws.readyState}`,
                );
                wsClientsSet.delete(ws);
            }
        });
    });
}

export const addWsClient = (id: string, ws: WebSocket) => {
    wsClientsMap.set(id, wsClientsMap.get(id) || new Set());
    wsClientsMap.get(id)?.add(ws);
};

export const removeWsClient = (id: string, ws: WebSocket) => {
    wsClientsMap.get(id)?.delete(ws);
};
