import { useState } from 'react'
import { usePortfolio } from '../contexts/PortfolioContext'
import { Plus, MoreVertical, Check, Star, Edit2, Trash2, X } from 'lucide-react'

export const PortfolioSelector = () => {
  const { portfolios, currentPortfolio, setCurrentPortfolio, createPortfolio, deletePortfolio, setDefaultPortfolio } = usePortfolio()
  const [showModal, setShowModal] = useState(false)
  const [showMenu, setShowMenu] = useState(null)
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [newPortfolioDescription, setNewPortfolioDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreatePortfolio = async (e) => {
    e.preventDefault()
    if (!newPortfolioName.trim()) {
      setError('El nombre es requerido')
      return
    }

    setLoading(true)
    setError('')

    try {
      await createPortfolio(newPortfolioName.trim(), newPortfolioDescription.trim())
      setNewPortfolioName('')
      setNewPortfolioDescription('')
      setShowModal(false)
    } catch (err) {
      setError(err.message || 'Error al crear portfolio')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePortfolio = async (portfolioId) => {
    try {
      await deletePortfolio(portfolioId)
      setShowMenu(null)
    } catch (err) {
      setError(err.message || 'Error al eliminar portfolio')
    }
  }

  const handleSetDefault = async (portfolioId) => {
    try {
      await setDefaultPortfolio(portfolioId)
      setShowMenu(null)
    } catch (err) {
      setError(err.message || 'Error al establecer portfolio por defecto')
    }
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowMenu(currentPortfolio?.id)}
          className="flex items-center gap-2 px-3 py-2 bg-background-tertiary hover:bg-border-primary rounded-lg border border-border-primary transition-all text-text-primary font-medium text-sm"
        >
          <div className="w-2 h-2 rounded-full bg-success"></div>
          {currentPortfolio?.name || 'Seleccionar Portfolio'}
          <MoreVertical className="w-4 h-4 text-text-tertiary" />
        </button>

        {showMenu && (
          <div className="absolute left-0 top-full mt-2 z-50 w-64 bg-background-secondary border border-border-primary rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-border-primary">
              <p className="text-text-tertiary text-xs font-medium px-2 py-1">PORTFOLIOS</p>
            </div>
            {portfolios.map((portfolio) => (
              <div key={portfolio.id} className="relative group">
                <button
                  onClick={() => {
                    setCurrentPortfolio(portfolio)
                    setShowMenu(null)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-background-tertiary transition-colors text-left"
                >
                  <div className="flex-1">
                    <p className="text-text-primary font-medium text-sm">{portfolio.name}</p>
                    {portfolio.description && (
                      <p className="text-text-tertiary text-xs">{portfolio.description}</p>
                    )}
                  </div>
                  {portfolio.is_default && (
                    <Star className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" />
                  )}
                  {currentPortfolio?.id === portfolio.id && (
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                  )}
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  {!portfolio.is_default && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSetDefault(portfolio.id)
                      }}
                      className="p-1.5 hover:bg-background-tertiary rounded text-text-tertiary hover:text-amber-500 transition-colors"
                      title="Establecer como por defecto"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeletePortfolio(portfolio.id)
                    }}
                    className="p-1.5 hover:bg-background-tertiary rounded text-text-tertiary hover:text-danger transition-colors"
                    title="Eliminar portfolio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                setShowModal(true)
                setShowMenu(null)
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-background-tertiary transition-colors text-success font-medium border-t border-border-primary"
            >
              <Plus className="w-4 h-4" />
              Nuevo Portfolio
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background-secondary rounded-xl p-6 w-full max-w-md border border-border-primary shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text-primary">Nuevo Portfolio</h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  setNewPortfolioName('')
                  setNewPortfolioDescription('')
                  setError('')
                }}
                className="text-text-tertiary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="bg-danger-muted border border-danger/50 text-danger px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleCreatePortfolio} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Nombre <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  className="w-full px-4 py-3 bg-background-tertiary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-success focus:border-transparent"
                  placeholder="Mi Portfolio"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={newPortfolioDescription}
                  onChange={(e) => setNewPortfolioDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-background-tertiary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-success focus:border-transparent resize-none"
                  placeholder="Descripción de tu portfolio..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setNewPortfolioName('')
                    setNewPortfolioDescription('')
                    setError('')
                  }}
                  className="flex-1 px-4 py-3 bg-background-tertiary text-text-primary rounded-lg hover:bg-border-primary transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-success text-white rounded-lg hover:bg-success/90 disabled:bg-success/50 transition-colors font-medium"
                >
                  {loading ? 'Creando...' : 'Crear Portfolio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
