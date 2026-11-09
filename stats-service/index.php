<?php
header('Content-Type: application/json');

// Base de données : un simple fichier
$db = new PDO('sqlite:/data/stats.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)");

// Lecture de la requête : /api/stats/events => ["api","stats","events"]
$method = $_SERVER['REQUEST_METHOD'];
$path   = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$parts  = explode('/', $path);
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

if ($parts[0] !== 'api' || ($parts[1] ?? '') !== 'stats') {
    http_response_code(404);
    exit(json_encode(['error' => 'Route inconnue']));
}

$third = $parts[2] ?? null;

// ENREGISTRER UN ÉVÉNEMENT : POST /api/stats/events
if ($method === 'POST' && $third === 'events') {
    $type = trim($body['type'] ?? '');
    if ($type === '') {
        http_response_code(400);
        exit(json_encode(['error' => 'Le champ type est obligatoire']));
    }
    $db->prepare("INSERT INTO events (type) VALUES (?)")->execute([$type]);
    http_response_code(201);
    exit(json_encode(['saved' => true, 'type' => $type]));
}

// VOIR TOUS LES COMPTEURS : GET /api/stats
if ($method === 'GET' && !$third) {
    $rows = $db->query("SELECT type, COUNT(*) AS total FROM events GROUP BY type")
               ->fetchAll(PDO::FETCH_KEY_PAIR);
    exit(json_encode($rows ?: new stdClass()));
}

// VOIR UN COMPTEUR : GET /api/stats/booking_created
if ($method === 'GET' && $third) {
    $s = $db->prepare("SELECT COUNT(*) FROM events WHERE type = ?");
    $s->execute([$third]);
    exit(json_encode(['type' => $third, 'total' => (int)$s->fetchColumn()]));
}

http_response_code(405);
echo json_encode(['error' => 'Méthode non supportée']);