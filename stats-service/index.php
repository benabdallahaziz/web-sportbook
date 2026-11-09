<?php
header('Content-Type: application/json');

// Base de données : un simple fichier
$db = new PDO('sqlite:/data/stats.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)");

// Lecture de la requête : /api/stats/events/3 => ["api","stats","events","3"]
$method = $_SERVER['REQUEST_METHOD'];
$path   = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$parts  = explode('/', $path);
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

if ($parts[0] !== 'api' || ($parts[1] ?? '') !== 'stats') {
    http_response_code(404);
    exit(json_encode(['error' => 'Route inconnue']));
}

$third = $parts[2] ?? null;
$id    = $parts[3] ?? null;

// ================= CRUD sur /api/stats/events =================
if ($third === 'events') {

    // CREATE : POST /api/stats/events
    if ($method === 'POST' && !$id) {
        $type = trim($body['type'] ?? '');
        if ($type === '') {
            http_response_code(400);
            exit(json_encode(['error' => 'Le champ type est obligatoire']));
        }
        $db->prepare("INSERT INTO events (type, description) VALUES (?, ?)")
           ->execute([$type, $body['description'] ?? null]);
        http_response_code(201);
        exit(json_encode(['id' => (int)$db->lastInsertId(), 'type' => $type]));
    }

    // READ (liste) : GET /api/stats/events
    if ($method === 'GET' && !$id) {
        exit(json_encode($db->query("SELECT * FROM events ORDER BY id")->fetchAll(PDO::FETCH_ASSOC)));
    }

    // READ (un seul) : GET /api/stats/events/3
    if ($method === 'GET' && $id) {
        $s = $db->prepare("SELECT * FROM events WHERE id = ?");
        $s->execute([$id]);
        $row = $s->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            exit(json_encode(['error' => 'Événement introuvable']));
        }
        exit(json_encode($row));
    }

    // UPDATE : PUT /api/stats/events/3
    if ($method === 'PUT' && $id) {
        $s = $db->prepare("SELECT * FROM events WHERE id = ?");
        $s->execute([$id]);
        $row = $s->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            exit(json_encode(['error' => 'Événement introuvable']));
        }
        $type        = trim($body['type'] ?? $row['type']);
        $description = $body['description'] ?? $row['description'];
        $db->prepare("UPDATE events SET type = ?, description = ? WHERE id = ?")
           ->execute([$type, $description, $id]);
        exit(json_encode(['updated' => true, 'id' => (int)$id]));
    }

    // DELETE : DELETE /api/stats/events/3
    if ($method === 'DELETE' && $id) {
        $s = $db->prepare("DELETE FROM events WHERE id = ?");
        $s->execute([$id]);
        if ($s->rowCount() === 0) {
            http_response_code(404);
            exit(json_encode(['error' => 'Événement introuvable']));
        }
        exit(json_encode(['deleted' => true, 'id' => (int)$id]));
    }
}

// ================= Statistiques (calculées) =================

// GET /api/stats : tous les compteurs
if ($method === 'GET' && !$third) {
    $rows = $db->query("SELECT type, COUNT(*) AS total FROM events GROUP BY type")
               ->fetchAll(PDO::FETCH_KEY_PAIR);
    exit(json_encode($rows ?: new stdClass()));
}

// GET /api/stats/booking_created : un compteur
if ($method === 'GET' && $third && $third !== 'events') {
    $s = $db->prepare("SELECT COUNT(*) FROM events WHERE type = ?");
    $s->execute([$third]);
    exit(json_encode(['type' => $third, 'total' => (int)$s->fetchColumn()]));
}

http_response_code(405);
echo json_encode(['error' => 'Méthode non supportée']);