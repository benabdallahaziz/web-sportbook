import json
import logging
import threading
from datetime import datetime
from typing import Any, Dict
import pika
from app.config import settings

logger = logging.getLogger("rabbitmq-publisher")


def _serialize_datetime(obj):
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return str(obj)


def get_rabbitmq_connection():
    """Crée une connexion sécurisée à RabbitMQ."""
    credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASSWORD)
    parameters = pika.ConnectionParameters(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        credentials=credentials,
        connection_attempts=2,
        retry_delay=1,
        socket_timeout=2.0
    )
    return pika.BlockingConnection(parameters)


def publish_event(routing_key: str, data: Dict[str, Any]) -> bool:
    """
    Publie un événement asynchrone sur l'Exchange Topic RabbitMQ 'sportbook.events'.
    Utilisé pour notifier les autres microservices (ex: Booking, Marketplace, User).

    Exemples de routing_key :
    - venue.created
    - venue.updated
    - venue.deleted
    - field.created
    - field.updated
    - field.deleted
    """
    if not settings.RABBITMQ_ENABLED:
        logger.debug("RabbitMQ is disabled. Event '%s' skipped.", routing_key)
        return False

    def _publish():
        try:
            connection = get_rabbitmq_connection()
            channel = connection.channel()

            # Déclaration de l'Exchange Topic
            channel.exchange_declare(
                exchange=settings.RABBITMQ_EXCHANGE,
                exchange_type="topic",
                durable=True
            )

            message_payload = {
                "source": settings.APP_NAME,
                "event": routing_key,
                "timestamp": datetime.utcnow().isoformat(),
                "data": data
            }

            body = json.dumps(message_payload, default=_serialize_datetime)

            channel.basic_publish(
                exchange=settings.RABBITMQ_EXCHANGE,
                routing_key=routing_key,
                body=body,
                properties=pika.BasicProperties(
                    content_type="application/json",
                    delivery_mode=2  # Message persistant
                )
            )

            connection.close()
            logger.info("RabbitMQ event published: %s -> %s", routing_key, body)
            return True
        except Exception as e:
            logger.warning("Could not publish RabbitMQ event '%s': %s", routing_key, e)
            return False

    # Exécution dans un thread séparé pour ne pas bloquer l'endpoint HTTP
    thread = threading.Thread(target=_publish, daemon=True)
    thread.start()
    return True
