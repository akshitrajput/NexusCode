package main

import (
	"log"
	"net/http"
	"nexus-code/backend/internal/ws"
)

func main() {
	hub := ws.NewHub()
	go hub.Run()

	// Handle WebSocket requests on the root path "/"
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(hub, w, r)
	})

	log.Println("NexusCode CRDT Server started on :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
