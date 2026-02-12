import { NextResponse } from 'next/server'
import { addSubscription, removeSubscription } from '@/lib/redis'
import type { PushSubscriptionRecord } from '@/lib/types'

export const POST = async (request: Request): Promise<NextResponse> => {
  try {
    const body = await request.json()
    const { subscription, action } = body as {
      subscription: {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }
      action: 'subscribe' | 'unsubscribe'
    }

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json(
        { error: 'Invalid subscription data' },
        { status: 400 }
      )
    }

    if (action === 'unsubscribe') {
      await removeSubscription(subscription.endpoint)
      return NextResponse.json({ success: true, action: 'unsubscribed' })
    }

    const record: PushSubscriptionRecord = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      createdAt: new Date().toISOString(),
    }

    await addSubscription(record)
    return NextResponse.json({ success: true, action: 'subscribed' })
  } catch (error) {
    console.error('Subscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to process subscription' },
      { status: 500 }
    )
  }
}
