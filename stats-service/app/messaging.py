"""Consommateur RabbitMQ (communication ASYNCHRONE).

  Producteur : tournament-events-service (Node.js)
  Exchange   : sportbook.events  (type "topic")
  Queue      : stats-service.match-events  (durable, propre à ce service)
  Bindings   : "match.*"            → match.updated, match.deleted
               "tournament.deleted"

Un exchange "topic" route chaque message vers les queues dont le motif
correspond à la routing key. Un futur notification-service pourrait créer
SA propre queue liée à "match.*" et recevoir les mêmes événements, sans
modifier le producteur.
"""
import asyncio
import json
import logging

import aio_pika

from . import config, sync

log = logging.getLogger("stats.messaging")

EXCHANGE = "sportbook.events"
QUEUE = "stats-service.match-events"
BINDINGS = ("match.*", "tournament.deleted")
RETRY_SECONDS = 10

state = {"connected": False}


async def _handle(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    try:
        payload = json.loads(message.body)
    except json.JSONDecodeError:
        log.error("Message illisible rejeté : %r", message.body[:200])
        await message.reject(requeue=False)
        return
    try:
        # Accès base = code bloquant → exécuté dans un thread pour ne pas figer le serveur
        await asyncio.to_thread(sync.handle_event, payload)
        await message.ack()  # « bien traité » : RabbitMQ peut supprimer le message
    except Exception:
        log.exception("Échec du traitement de %s, nouvel essai dans 5 s", payload.get("event"))
        await asyncio.sleep(5)
        await message.nack(requeue=True)  # remis dans la queue


async def consume_forever() -> None:
    """Se connecte à RabbitMQ et consomme les messages ; réessaie si le broker est arrêté."""
    while True:
        try:
            connection = await aio_pika.connect_robust(config.RABBITMQ_URL)
            async with connection:
                channel = await connection.channel()
                await channel.set_qos(prefetch_count=10)
                exchange = await channel.declare_exchange(EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
                queue = await channel.declare_queue(QUEUE, durable=True)
                for key in BINDINGS:
                    await queue.bind(exchange, routing_key=key)
                state["connected"] = True
                log.info("✅ RabbitMQ connecté : écoute de %s sur %s", ", ".join(BINDINGS), QUEUE)
                async with queue.iterator() as messages:
                    async for message in messages:
                        await _handle(message)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if state["connected"] or not state.get("warned"):
                log.warning("RabbitMQ indisponible (%s), nouvel essai toutes les %d s", exc, RETRY_SECONDS)
                state["warned"] = True
            state["connected"] = False
            await asyncio.sleep(RETRY_SECONDS)
