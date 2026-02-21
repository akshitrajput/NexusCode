package ws

import (
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
)

// Manager holds all the active room Hubs
type Manager struct {
	hubs         map[string]*Hub
	sync.RWMutex // Protects the map from race conditions
}

// NewManager creates a new Manager
func NewManager() *Manager {
	return &Manager{
		hubs: make(map[string]*Hub),
	}
}

// GetOrCreateHub safely retrieves an existing hub or creates a new one
func (m *Manager) GetOrCreateHub(roomID string) *Hub {
	m.Lock()
	defer m.Unlock()

	hub, exists := m.hubs[roomID]
	if !exists {
		log.Printf("Creating new room: %s", roomID)
		hub = NewHub(roomID, m)
		m.hubs[roomID] = hub
		go hub.Run() // Start the room's engine
	}
	return hub
}

// RemoveHub deletes the hub from memory when empty (Garbage Collection)
func (m *Manager) RemoveHub(roomID string) {
	m.Lock()
	defer m.Unlock()

	if _, exists := m.hubs[roomID]; exists {
		log.Printf("Closing empty room: %s", roomID)
		delete(m.hubs, roomID)
	}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ServeWS is the HTTP handler that assigns users to the correct room
func (m *Manager) ServeWS(w http.ResponseWriter, r *http.Request) {
	// 1. Extract the room ID from the URL Path (e.g., /room-1 -> room-1)
	roomID := strings.TrimPrefix(r.URL.Path, "/")
	if roomID == "" {
		roomID = "global" // Default fallback
	}

	// 2. Get or create the specific room
	hub := m.GetOrCreateHub(roomID)

	// 3. Upgrade the connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	// 4. Register the client to this specific hub
	hub.register <- conn

	// 5. Start listening to this client
	go func() {
		defer func() {
			hub.unregister <- conn
		}()
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				break
			}
			hub.broadcast <- message
		}
	}()
}
