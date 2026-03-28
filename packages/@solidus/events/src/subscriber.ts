import amqp from 'amqplib'
import type { SolidusEvent, SolidusEventType } from './types.js'

const EXCHANGE = 'solidus.events'

export async function subscribe(
  url: string,
  queue: string,
  patterns: SolidusEventType[],
  handler: (event: SolidusEvent) => Promise<void>,
): Promise<void> {
  const connection = await amqp.connect(url)
  const channel = await connection.createChannel()

  await channel.assertExchange(EXCHANGE, 'topic', { durable: true })
  await channel.assertQueue(queue, { durable: true })

  for (const pattern of patterns) {
    await channel.bindQueue(queue, EXCHANGE, pattern)
  }

  channel.prefetch(1)
  await channel.consume(queue, async (msg) => {
    if (!msg) return
    try {
      const event = JSON.parse(msg.content.toString()) as SolidusEvent
      await handler(event)
      channel.ack(msg)
    } catch {
      channel.nack(msg, false, false) // dead-letter on failure
    }
  })
}
