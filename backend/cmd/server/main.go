package main

import (
	"log"
	"net/http"
	"nexus-code/backend/internal/ws" // Ensure this matches your project module path
)

func main() {
	// Initialize the centralized Room Manager
	manager := ws.NewManager()

	// Route all WebSocket traffic through the Manager's ServeWS method
	http.HandleFunc("/", manager.ServeWS)

	log.Println("NexusCode Multi-Room Server started on :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("Server failed to start:", err)
	}
}