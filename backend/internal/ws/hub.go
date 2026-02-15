package ws

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// Hub maintains the set of active clients and broadcasts messages.
type Hub struct {
	// Registered clients.
	clients map[*websocket.Conn]bool

	// Inbound messages from the clients.
	broadcast chan []byte

	// Register requests from the clients.
	register chan *websocket.Conn

	// Unregister requests from clients.
	unregister chan *websocket.Conn

	// A history of all updates to sync new users, In production, this would be stored in Redis.
	history [][]byte

	mu sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		clients:    make(map[*websocket.Conn]bool),
		history:    make([][]byte, 0),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			
			// SYNC: When a new user joins, send them the entire history
			if len(h.history) > 0 {
				log.Printf("Client joined. Syncing %d history events...", len(h.history))
				for _, msg := range h.history {
					// We use BinaryMessage (OpCode 2) for Yjs updates
					client.WriteMessage(websocket.BinaryMessage, msg)
				}
			}
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.Lock()
			
			// STORE: Append to history (Event Sourcing)
			h.history = append(h.history, message)

			// FORWARD: Broadcast to everyone (including sender, Yjs handles deduplication)
			for client := range h.clients {
				err := client.WriteMessage(websocket.BinaryMessage, message)
				if err != nil {
					log.Printf("Websocket error: %v", err)
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

// ServeWs handles websocket requests from the peer.
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	hub.register <- conn

	go func() {
		defer func() {
			hub.unregister <- conn
		}()
		for {
			// ReadMessage now handles the raw byte stream
			_, message, err := conn.ReadMessage()
			if err != nil {
				break
			}
			hub.broadcast <- message
		}
	}()
}