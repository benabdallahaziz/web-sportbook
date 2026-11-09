using System.Text;
using System.Text.Json;
using CoachTrainingService.Dtos;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace CoachTrainingService.Services;

/// <summary>
/// Service d'arrière-plan Consumer RabbitMQ (Atelier 6 - Communication Asynchrone).
/// Écoute la file 'sportbook.session.notifications' et simule le traitement (envoi d'email).
/// </summary>
public class NotificationConsumerService : BackgroundService
{
    private readonly IConfiguration _config;
    private readonly ILogger<NotificationConsumerService> _logger;

    public NotificationConsumerService(IConfiguration config, ILogger<NotificationConsumerService> logger)
    {
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var enabled = _config.GetValue<bool>("RabbitMQ:Enabled", true);
        if (!enabled) return;

        // Attente de démarrage complet du serveur web
        await Task.Delay(2000, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var uriString = _config["RabbitMQ:Uri"];
                ConnectionFactory factory;
                if (!string.IsNullOrWhiteSpace(uriString))
                {
                    factory = new ConnectionFactory
                    {
                        Uri = new Uri(uriString),
                        RequestedConnectionTimeout = TimeSpan.FromSeconds(5),
                        DispatchConsumersAsync = true
                    };
                }
                else
                {
                    factory = new ConnectionFactory
                    {
                        HostName = _config["RabbitMQ:HostName"] ?? "localhost",
                        Port = int.TryParse(_config["RabbitMQ:Port"], out var p) ? p : 5672,
                        UserName = _config["RabbitMQ:UserName"] ?? "guest",
                        Password = _config["RabbitMQ:Password"] ?? "guest",
                        RequestedConnectionTimeout = TimeSpan.FromSeconds(5),
                        DispatchConsumersAsync = true
                    };
                }

                using var connection = factory.CreateConnection();
                using var channel = connection.CreateModel();

                var exchange = _config["RabbitMQ:ExchangeName"] ?? "sportbook.exchange";
                var queue = _config["RabbitMQ:QueueName"] ?? "sportbook.session.notifications";
                var routingKey = _config["RabbitMQ:RoutingKey"] ?? "coach.session.booked";

                channel.ExchangeDeclare(exchange: exchange, type: ExchangeType.Direct, durable: true, autoDelete: false);
                channel.QueueDeclare(queue: queue, durable: true, exclusive: false, autoDelete: false);
                channel.QueueBind(queue: queue, exchange: exchange, routingKey: routingKey);

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.Received += async (model, ea) =>
                {
                    var body = ea.Body.ToArray();
                    var message = Encoding.UTF8.GetString(body);

                    try
                    {
                        var evt = JsonSerializer.Deserialize<SessionBookedEvent>(message);
                        if (evt != null)
                        {
                            _logger.LogInformation("📥 [RabbitMQ Consumer] Message reçu ! Inscription confirmée pour l'utilisateur {UserId} ({Email}) - Programme : '{Program}' - Date : {Date} à {Time}",
                                evt.UserId, evt.UserEmail ?? "N/A", evt.ProgramName ?? "Inconnu", evt.Date, evt.StartTime);

                            _logger.LogInformation("📧 [Email Service] Simulation : Email de confirmation envoyé avec succès à '{Email}' !",
                                evt.UserEmail ?? $"user_{evt.UserId}@sportbook.tn");
                        }

                        channel.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ Erreur de traitement du message RabbitMQ.");
                        channel.BasicNack(deliveryTag: ea.DeliveryTag, multiple: false, requeue: false);
                    }

                    await Task.Yield();
                };

                channel.BasicConsume(queue: queue, autoAck: false, consumer: consumer);
                _logger.LogInformation("👂 [RabbitMQ Consumer] En écoute sur la file '{Queue}'...", queue);

                // Maintenir la connexion active tant que le token d'annulation n'est pas déclenché
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("⚠️ [RabbitMQ Consumer] En attente de connexion à RabbitMQ (nouvelle tentative dans 10s) : {Message}", ex.Message);
                await Task.Delay(10000, stoppingToken);
            }
        }
    }
}

