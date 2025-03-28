import { Identity } from "@clockworklabs/spacetimedb-sdk";
import React, { useCallback, useEffect, useState } from "react";
import {
  DbConnection,
  ErrorContext,
  EventContext,
  Game,
  Message,
  User,
} from "../module_bindings";
import { SpacetimeContext } from "./spacetime-context";

/**
 * Helper to subscribe to queries on connection.
 */
const subscribeToQueries = (conn: DbConnection, queries: string[]) => {
  for (const query of queries) {
    conn
      .subscriptionBuilder()
      .onApplied(() => {
        console.log("SDK client cache initialized.");
      })
      .onError((err) => {
        console.error("Error subscribing to query:", err);
      })
      .subscribe(query);
  }
};

/**
 * Custom hook to subscribe to Message events.
 */
function useMessages(conn: DbConnection | null): Message[] {
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, message: Message) => {
      setMessages((prev) => [...prev, message]);
    };
    conn.db.message.onInsert(onInsert);
    const onDelete = (_ctx: EventContext, message: Message) => {
      setMessages((prev) =>
        prev.filter(
          (m) =>
            m.text !== message.text &&
            m.sent !== message.sent &&
            m.sender !== message.sender
        )
      );
    };
    conn.db.message.onDelete(onDelete);
    return () => {
      conn.db.message.removeOnInsert(onInsert);
      conn.db.message.removeOnDelete(onDelete);
    };
  }, [conn]);
  return messages;
}

/**
 * Custom hook to subscribe to Game events.
 */
function useGames(conn: DbConnection | null): Game[] {
  const [games, setGames] = useState<Game[]>([]);
  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, game: Game) => {
      setGames((prev) => [...prev, game]);
    };
    const onDelete = (_ctx: EventContext, game: Game) => {
      setGames((prev) => prev.filter((g) => g.id !== game.id));
    };
    const onUpdate = (_ctx: EventContext, _oldGame: Game, newGame: Game) => {
      setGames((prev) => prev.map((g) => (g.id === newGame.id ? newGame : g)));
    };
    conn.db.game.onInsert(onInsert);
    conn.db.game.onDelete(onDelete);
    conn.db.game.onUpdate(onUpdate);
    return () => {
      conn.db.game.removeOnInsert(onInsert);
      conn.db.game.removeOnDelete(onDelete);
      conn.db.game.removeOnUpdate(onUpdate);
    };
  }, [conn]);
  return games;
}

/**
 * Custom hook to subscribe to User events.
 */
function useUsers(conn: DbConnection | null): Map<string, User> {
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, user: User) => {
      setUsers((prev) => new Map(prev.set(user.identity.toHexString(), user)));
    };
    conn.db.user.onInsert(onInsert);
    const onUpdate = (_ctx: EventContext, oldUser: User, newUser: User) => {
      setUsers((prev) => {
        prev.delete(oldUser.identity.toHexString());
        return new Map(prev.set(newUser.identity.toHexString(), newUser));
      });
    };
    conn.db.user.onUpdate(onUpdate);
    const onDelete = (_ctx: EventContext, user: User) => {
      setUsers((prev) => {
        prev.delete(user.identity.toHexString());
        return new Map(prev);
      });
    };
    conn.db.user.onDelete(onDelete);
    return () => {
      conn.db.user.removeOnInsert(onInsert);
      conn.db.user.removeOnUpdate(onUpdate);
      conn.db.user.removeOnDelete(onDelete);
    };
  }, [conn]);
  return users;
}

/**
 * The provider that wraps your app.
 */
export const SpacetimeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [systemMessage, setSystemMessage] = useState<string>("");

  // Use our custom hooks to subscribe to real-time updates
  const messages = useMessages(conn);
  const games = useGames(conn);
  const users = useUsers(conn);

  useEffect(() => {
    const onConnect = (
      connection: DbConnection,
      identity: Identity,
      token: string
    ) => {
      setIdentity(identity);
      setConnected(true);
      localStorage.setItem("auth_token", token);
      console.log("Connected with identity:", identity.toHexString());
      connection.reducers.onSendMessage(() => console.log("Message sent."));
      connection.reducers.onCreateGame(() => console.log("Game created."));
      subscribeToQueries(connection, [
        "SELECT * FROM message",
        "SELECT * FROM user",
        "SELECT * FROM game",
      ]);
    };

    const onDisconnect = () => {
      console.log("Disconnected");
      setConnected(false);
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.error("Connection error:", err);
    };
    console.log({ brandin: import.meta.env.VITE_CODESPACE_NAME });
    console.log({ brandin2: import.meta.env.VITE_SPACETIMEDB_URL });
console.log(import.meta.env.BASE_URL)
    
const v = import.meta.env
console.log({v})
    // Build the connection
    const connection = DbConnection.builder()
      .withUri(import.meta.env.VITE_SPACETIMEDB_URL)
      .withModuleName("quickstart-chat")
      .withToken(localStorage.getItem("auth_token") || "")
      .onConnect(onConnect)
      .onDisconnect(onDisconnect)
      .onConnectError(onConnectError)
      .build();

    setConn(connection);
  }, []);

  // Listen for user online/offline events to update the system message
  useEffect(() => {
    if (!conn) return;
    const onUserInsert = (_ctx: EventContext, user: User) => {
      if (user.online) {
        const name = user.name || user.identity.toHexString().substring(0, 8);
        setSystemMessage((prev) => prev + `\n${name} has connected.`);
      }
    };
    const onUserUpdate = (_ctx: EventContext, oldUser: User, newUser: User) => {
      const name =
        newUser.name || newUser.identity.toHexString().substring(0, 8);
      if (!oldUser.online && newUser.online) {
        setSystemMessage((prev) => prev + `\n${name} has connected.`);
      } else if (oldUser.online && !newUser.online) {
        setSystemMessage((prev) => prev + `\n${name} has disconnected.`);
      }
    };
    conn.db.user.onInsert(onUserInsert);
    conn.db.user.onUpdate(onUserUpdate);
    return () => {
      conn.db.user.removeOnInsert(onUserInsert);
      conn.db.user.removeOnUpdate(onUserUpdate);
    };
  }, [conn]);

  //   const name =
  // users.get(identity.toHexString())?.name ||
  // identity.toHexString().substring(0, 8) ||
  // "";

  const getUserName = useCallback(
    (identity: Identity) => {
      return (
        users.get(identity.toHexString())?.name ||
        identity.toHexString().substring(0, 8)
      );
    },
    [users]
  );

  return (
    <SpacetimeContext.Provider
      value={{
        conn,
        connected,
        identity,
        messages,
        games,
        users,
        systemMessage,
        getUserName,
      }}
    >
      {children}
    </SpacetimeContext.Provider>
  );
};
