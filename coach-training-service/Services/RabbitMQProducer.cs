using System.Text;
using System.Text.Json;
using CoachTrainingService.Dtos;
using RabbitMQ.Client;

namespace CoachTrainingService.Services;

/// <summary>
/// Service Producer RabbitMQ (Atelier 6 - Communication Asynchrone).
/// Publie des événements métier sur l'Exchange 'sportbook.exchange'.
/// </summary>
public class RabbitMQProducer
{
    private readonly IConfiguration _config;
    private readonly ILogger<RabbitMQProducer> _logger;

    public RabbitMQProducer(IConfiguration config, ILogger<RabbitMQProducer> logger)
    {
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Publie un événement 'SessionBookedEvent' lorsqu'un sportif s'inscrit à une séance.
    /// </summary>
    public void PublishSessionBooked(SessionBookedEvent evt)
    {
        var enabled = _config.GetValue<bool>("RabbitMQ:Enabled", true);
        if (!enabled)
        {
            _logger.LogInformation("ℹ️ [RabbitMQ] Désactivé dans la configuration.");
            return;
        }

        try
        {
            var uriString = _config["RabbitMQ:Uri"];
            ConnectionFactory factory;
            if (!string.IsNullOrWhiteSpace(uriString))
            {
                factory = new ConnectionFactory { Uri = new Uri(uriString), RequestedConnectionTimeout = TimeSpan.FromSeconds(5) };
            }
            else
            {
                factory = new ConnectionFactory
                {
                    HostName = _config["RabbitMQ:HostName"] ?? "localhost",
                    Port = int.TryParse(_config["RabbitMQ:Port"], out var p) ? p : 5672,
                    UserName = _config["RabbitMQ:UserName"] ?? "guest",
                    Password = _config["RabbitMQ:Password"] ?? "guest",
                    RequestedConnectionTimeout = TimeSpan.FromSeconds(5)
                };
            }

            using var connection = factory.CreateConnection();
            using var channel = connection.CreateModel();

            var exchange = _config["RabbitMQ:ExchangeName"] ?? "sportbook.exchange";
            var queue = _config["RabbitMQ:QueueName"] ?? "sportbook.session.notifications";
            var routingKey = _config["RabbitMQ:RoutingKey"] ?? "coach.session.booked";

            // 1. Déclarer l'Exchange (Direct)
            channel.ExchangeDeclare(exchange: exchange, type: ExchangeType.Direct, durable: true, autoDelete: false);

            // 2. Déclarer la Queue
            channel.QueueDeclare(queue: queue, durable: true, exclusive: false, autoDelete: false);

            // 3. Lier la Queue à l'Exchange via la Routing Key
            channel.QueueBind(queue: queue, exchange: exchange, routingKey: routingKey);

            // 4. Sérialiser le message JSON
            var json = JsonSerializer.Serialize(evt, new JsonSerializerOptions { WriteIndented = false });
            var body = Encoding.UTF8.GetBytes(json);

            var properties = channel.CreateBasicProperties();
            properties.Persistent = true;
            properties.ContentType = "application/json";
            properties.MessageId = evt.EventId;
            properties.Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds());

            // 5. Publier sur l'Exchange
            channel.BasicPublish(
                exchange: exchange,
                routingKey: routingKey,
                basicProperties: properties,
                body: body
            );

            _logger.LogInformation("📢 [RabbitMQ Producer] Événement publié avec succès sur '{Exchange}' (RoutingKey: '{RoutingKey}') : {EventId}",
                exchange, routingKey, evt.EventId);
        }
        catch (Exception ex)
        {
            // En microservices, un problème temporaire du Broker ne doit pas bloquer la transaction métier locale
            _logger.LogWarning("⚠️ [RabbitMQ Producer] Impossible de publier l'événement (RabbitMQ hors ligne) : {Message}", ex.Message);
        }
    }
}

