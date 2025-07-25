import BoardRoomPage from '../components/BoardRoomPage'
import Board from '../features/board/Board'

export default function HomePage() {
  return (
    <div className="h-screen">
      <BoardRoomPage />
      {/* Uncomment to test Board component directly */}
      {/* <Board 
        onBoardStateChange={(name, status, hasChanges) => console.log('Board state:', { name, status, hasChanges })}
        onOpenBoardRoom={() => console.log('Open board room')}
      /> */}
    </div>
  )
}
