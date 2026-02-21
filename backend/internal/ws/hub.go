package ws

import (
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// Hub maintains the set of active clients in a SPECIFIC room.
type Hub struct {
	roomID     string
	manager    *Manager // Reference back to the manager for cleanup
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	history    [][]byte
	mu         sync.Mutex
}

// NewHub initializes a new room Hub
func NewHub(roomID string, manager *Manager) *Hub {
	return &Hub{
		roomID:     roomID,
		manager:    manager,
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		clients:    make(map[*websocket.Conn]bool),
		history:    make([][]byte, 0),
	}
}

// Run starts the Hub's main loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			log.Printf("[Room: %s] Client joined. Syncing %d events...", h.roomID, len(h.history))
			for _, msg := range h.history {
				client.WriteMessage(websocket.BinaryMessage, msg)
			}
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
			// Check if room is empty
			isEmpty := len(h.clients) == 0
			h.mu.Unlock()

			// Memory Leak Prevention: Shut down the Goroutine if room is empty
			if isEmpty {
				h.manager.RemoveHub(h.roomID)
				return // THIS KILLS THE GOROUTINE safely
			}

		case message := <-h.broadcast:
			h.mu.Lock()
			h.history = append(h.history, message)

			for client := range h.clients {
				err := client.WriteMessage(websocket.BinaryMessage, message)
				if err != nil {
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}