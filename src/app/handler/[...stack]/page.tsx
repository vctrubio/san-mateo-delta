import { StackHandler } from '@stackframe/stack';
import { stackServerApp } from '@/stack';

type HandlerProps = Parameters<typeof StackHandler>[0]['routeProps'];

export default function Handler(props: HandlerProps) {
  return <StackHandler fullPage app={stackServerApp} routeProps={props} />;
}
