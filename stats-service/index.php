<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Base de données : un simple fichier
$db = new PDO('sqlite:/data/stats.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)");
$db->exec("CREATE TABLE IF NOT EXISTS team_ranking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    team_name TEXT,
    tournament_id INTEGER,
    points INTEGER DEFAULT 0,
    elo REAL DEFAULT 1000
)");

// Lecture de la requête
$method = $_SERVER['REQUEST_METHOD'];
$path   = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$parts  = explode('/', $path);
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

// Santé du service
if ($parts[0] === 'health') {
    exit(json_encode(['status' => 'UP', 'service' => 'stats-service']));
}

// Page d'interface
if ($parts[0] === 'dashboard') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/dashboard.html');
    exit;
}

if ($parts[0] !== 'api' || ($parts[1] ?? '') !== 'stats') {
    http_response_code(404);
    exit(json_encode(['error' => 'Route inconnue']));
}

$third = $parts[2] ?? null;
$id    = $parts[3] ?? null;

// ================= CRUD sur /api/stats/events =================
if ($third === 'events') {

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

    if ($method === 'GET' && !$id) {
        $type = $_GET['type'] ?? null;
        if ($type) {
            $s = $db->prepare("SELECT * FROM events WHERE type = ? ORDER BY id");
            $s->execute([$type]);
            exit(json_encode($s->fetchAll(PDO::FETCH_ASSOC)));
        }
        exit(json_encode($db->query("SELECT * FROM events ORDER BY id")->fetchAll(PDO::FETCH_ASSOC)));
    }

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

// ================= Classement des équipes =================
if ($third === 'ranking') {

    // GET /api/stats/ranking?order_by=points&tournament_id=1
    if ($method === 'GET' && !$id) {
        $order = (($_GET['order_by'] ?? 'elo') === 'points') ? 'points' : 'elo';
        $sql  = "SELECT id, team_id, team_name, points, elo FROM team_ranking";
        $args = [];
        if (!empty($_GET['tournament_id'])) {
            $sql .= " WHERE tournament_id = ?";
            $args[] = $_GET['tournament_id'];
        }
        $s = $db->prepare("$sql ORDER BY $order DESC");
        $s->execute($args);
        $rows = $s->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $i => $r) {
            $rows[$i]['id']      = (int)$r['id'];
            $rows[$i]['team_id'] = (int)$r['team_id'];
            $rows[$i]['points']  = (int)$r['points'];
            $rows[$i]['elo']     = (float)$r['elo'];
        }
        exit(json_encode(['ranking' => $rows]));
    }

    if ($method === 'POST' && !$id) {
        if (empty($body['team_id'])) {
            http_response_code(400);
            exit(json_encode(['error' => 'team_id est obligatoire']));
        }
        $db->prepare("INSERT INTO team_ranking (team_id, team_name, tournament_id, points, elo) VALUES (?, ?, ?, ?, ?)")
           ->execute([$body['team_id'], $body['team_name'] ?? null, $body['tournament_id'] ?? null,
                      $body['points'] ?? 0, $body['elo'] ?? 1000]);
        http_response_code(201);
        exit(json_encode(['id' => (int)$db->lastInsertId()]));
    }

    if ($method === 'PUT' && $id) {
        $s = $db->prepare("SELECT * FROM team_ranking WHERE id = ?");
        $s->execute([$id]);
        $row = $s->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            exit(json_encode(['error' => 'Introuvable']));
        }
        $db->prepare("UPDATE team_ranking SET team_name = ?, points = ?, elo = ? WHERE id = ?")
           ->execute([$body['team_name'] ?? $row['team_name'], $body['points'] ?? $row['points'],
                      $body['elo'] ?? $row['elo'], $id]);
        exit(json_encode(['updated' => true, 'id' => (int)$id]));
    }

    if ($method === 'DELETE' && $id) {
        $s = $db->prepare("DELETE FROM team_ranking WHERE id = ?");
        $s->execute([$id]);
        if ($s->rowCount() === 0) {
            http_response_code(404);
            exit(json_encode(['error' => 'Introuvable']));
        }
        exit(json_encode(['deleted' => true, 'id' => (int)$id]));
    }
}

// ================= Statistiques calculées =================

// GET /api/stats : tous les compteurs
if ($method === 'GET' && !$third) {
    $rows = $db->query("SELECT type, COUNT(*) AS total FROM events GROUP BY type")
               ->fetchAll(PDO::FETCH_KEY_PAIR);
    exit(json_encode($rows ?: new stdClass()));
}

// GET /api/stats/booking_created : un compteur
if ($method === 'GET' && $third && $third !== 'events' && $third !== 'ranking') {
    $s = $db->prepare("SELECT COUNT(*) FROM events WHERE type = ?");
    $s->execute([$third]);
    exit(json_encode(['type' => $third, 'total' => (int)$s->fetchColumn()]));
}

http_response_code(405);
echo json_encode(['error' => 'Méthode non supportée']);