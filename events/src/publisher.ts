import amqp from 'amqplib'
import { randomUUID } from 'node:crypto'
import type { SolidusEvent, SolidusEventType, BaseEvent } from './types.js'

const EXCHANGE = 'solidus.events'

let _connection: Awaited<ReturnType<typeof amqp.connect>> | null = null
let _channel: amqp.Channel | null = null

async function getChannel(): Promise<amqp.Channel> {
  if (_channel) return _channel
  const url = process.env['RABBITMQ_URL']
  if (!url) throw new Error('RABBITMQ_URL is required')
  _connection = await amqp.connect(url)
  _channel = await _connection.createChannel()
  await _channel.assertExchange(EXCHANGE, 'topic', { durable: true })
  return _channel
}

export async function publish<T extends SolidusEvent>(
  source: string,
  type: T['type'],
  payload: Omit<T, keyof BaseEvent>,
): Promise<void> {
  const ch = await getChannel()
  const event = {
    id: randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    source,
    ...payload,
  }
  ch.publish(
    EXCHANGE,
    type,
    Buffer.from(JSON.stringify(event)),
    { persistent: true, contentType: 'application/json' },
  )
}

export async function closePublisher(): Promise<void> {
  await _channel?.close()
  await _connection?.close()
  _channel = null
  _connection = null
}
