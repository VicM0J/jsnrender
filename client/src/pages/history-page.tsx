import { useState } from "react";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Calendar, Filter, Download, Trash2, Eye, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Order, type Area } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { OrderHistoryModal } from "@/components/orders/order-history-modal";
import { OrderDetailsModal } from "@/components/orders/order-details-modal";
import { apiRequest } from "@/lib/queryClient";
import Swal from 'sweetalert2';

export default function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [completionTimeFilter, setCompletionTimeFilter] = useState<string>("all");
  const [includePaused, setIncludePaused] = useState(false);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const getAreaDisplayName = (area: Area) => {
    const names: Record<Area, string> = {
      corte: 'Corte',
      bordado: 'Bordado',
      ensamble: 'Ensamble',
      plancha: 'Plancha/Empaque',
      calidad: 'Calidad',
      envios: 'Envíos',
      admin: 'Admin'
    };
    return names[area] || area;
  };

  const getAreaBadgeColor = (area: Area) => {
    const colors: Record<Area, string> = {
      corte: "badge-corte",
      bordado: "badge-bordado",
      ensamble: "badge-ensamble", 
      plancha: "badge-plancha",
      calidad: "badge-calidad",
      envios: "badge-envios",
      almacen: "bg-indigo-100 text-indigo-800",
      admin: "badge-admin",
    };
    return colors[area] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'completed' 
      ? "status-completed"
      : "status-active";
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Mexico_City'
    });
  };

  const filterOrdersByDate = (order: Order) => {
    if (dateFilter === "all") return true;

    const orderDate = new Date(order.createdAt);
    const now = new Date();

    switch (dateFilter) {
      case "today":
        return orderDate.toDateString() === now.toDateString();
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return orderDate >= weekAgo;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return orderDate >= monthAgo;
      default:
        return true;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchTerm === "" || 
      order.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clienteHotel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.noSolicitud?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.tipoPrenda?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.color?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.tela?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesArea = areaFilter === "all" || order.currentArea === areaFilter;

    const matchesStatus = statusFilter === "all" || order.status === statusFilter;

    const matchesDate = (() => {
      if (dateFilter === "all") return true;

      const orderDate = new Date(order.createdAt);
      const now = new Date();

      switch (dateFilter) {
        case "today":
          return orderDate.toDateString() === now.toDateString();
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return orderDate >= weekAgo;
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return orderDate >= monthAgo;
        case "quarter":
          const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          return orderDate >= quarterAgo;
        case "semester":
          const semesterAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          return orderDate >= semesterAgo;
        case "year":
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          return orderDate >= yearAgo;
        default:
          return true;
      }
    })();

    const matchesSize = (() => {
      if (sizeFilter === "all") return true;
      const pieces = order.totalPiezas;
      switch (sizeFilter) {
        case "small": return pieces >= 1 && pieces <= 49;
        case "medium": return pieces >= 50 && pieces <= 99;
        case "large": return pieces >= 100;
        default: return true;
      }
    })();

    const matchesCompletionTime = (() => {
      if (completionTimeFilter === "all" || !order.completedAt) return true;

      const created = new Date(order.createdAt);
      const completed = new Date(order.completedAt);
      const diffDays = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

      switch (completionTimeFilter) {
        case "fast": return diffDays < 1;
        case "normal": return diffDays >= 1 && diffDays <= 3;
        case "slow": return diffDays > 3;
        default: return true;
      }
    })();

    const matchesPausedFilter = includePaused || order.status !== 'paused';

    return matchesSearch && matchesArea && matchesStatus && matchesDate && matchesSize && matchesCompletionTime && matchesPausedFilter;
  }).sort((a, b) => {
    let aValue: any, bValue: any;

    switch (sortBy) {
      case "createdAt":
        aValue = new Date(a.createdAt);
        bValue = new Date(b.createdAt);
        break;
      case "completedAt":
        aValue = a.completedAt ? new Date(a.completedAt) : new Date(0);
        bValue = b.completedAt ? new Date(b.completedAt) : new Date(0);
        break;
      case "folio":
        aValue = a.folio;
        bValue = b.folio;
        break;
      case "clienteHotel":
        aValue = a.clienteHotel;
        bValue = b.clienteHotel;
        break;
      case "totalPiezas":
        aValue = a.totalPiezas;
        bValue = b.totalPiezas;
        break;
      default:
        aValue = new Date(a.createdAt);
        bValue = new Date(b.createdAt);
    }

    if (sortOrder === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const completedOrders = filteredOrders.filter(order => order.status === 'completed');
  const activeOrders = filteredOrders.filter(order => order.status === 'active');

  const deleteMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar pedido');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Pedido eliminado",
        description: "El pedido ha sido eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteOrder = async (orderId: number) => {
    if (user?.area !== 'admin' && user?.area !== 'envios') {
      toast({
        title: "Sin permisos",
        description: "Solo Admin o Envíos pueden eliminar pedidos",
        variant: "destructive",
      });
      return;
    }

    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      deleteMutation.mutate(orderId);
    }
  };

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/history/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchTerm,
          statusFilter,
          areaFilter,
          dateFilter,
          orders: filteredOrders
        }),
      });

      if (!response.ok) {
        throw new Error('Error al exportar datos');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `historial-pedidos-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Éxito",
        description: "Historial exportado correctamente",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "No se pudo exportar el historial",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Historial de Pedidos</h1>
          <p className="text-gray-600 mt-2">Registro completo de todos los pedidos del sistema</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleExportToExcel}
          disabled={isExporting || filteredOrders.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exportando...' : 'Exportar Excel'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Total de Pedidos</p>
              <p className="text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Pedidos Activos</p>
              <p className="text-2xl font-bold text-blue-600">{activeOrders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Pedidos Completados</p>
              <p className="text-2xl font-bold text-green-600">{completedOrders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Tasa de Éxito</p>
              <p className="text-2xl font-bold text-purple-600">
                {filteredOrders.length > 0 ? Math.round((completedOrders.length / filteredOrders.length) * 100) : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 border-blue-200 dark:border-slate-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
            <Search className="w-5 h-5" />
            Búsqueda y Filtros Avanzados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative col-span-1 md:col-span-2">
              <Input
                type="text"
                placeholder="Buscar por folio, cliente, modelo, No. solicitud, tipo, color, tela..."
                className="pl-10 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-300" />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="active">En Proceso</SelectItem>
                <SelectItem value="completed">Finalizados</SelectItem>
                <SelectItem value="paused">Pausados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={areaFilter} onValueChange={setAreaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Áreas</SelectItem>
                <SelectItem value="patronaje">Patronaje</SelectItem>
                <SelectItem value="corte">Corte</SelectItem>
                <SelectItem value="bordado">Bordado</SelectItem>
                <SelectItem value="ensamble">Ensamble</SelectItem>
                <SelectItem value="plancha">Plancha/Empaque</SelectItem>
                <SelectItem value="calidad">Calidad</SelectItem>
                <SelectItem value="envios">Envíos</SelectItem>
                <SelectItem value="almacen">Almacén</SelectItem>
                <SelectItem value="diseño">Diseño</SelectItem>
                <SelectItem value="operaciones">Operaciones</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el tiempo</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mes</SelectItem>
                <SelectItem value="quarter">Último trimestre</SelectItem>
                <SelectItem value="semester">Último semestre</SelectItem>
                <SelectItem value="year">Último año</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tamaño pedido" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tamaños</SelectItem>
                <SelectItem value="small">Pequeño (1-49 piezas)</SelectItem>
                <SelectItem value="medium">Mediano (50-99 piezas)</SelectItem>
                <SelectItem value="large">Grande (100+ piezas)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={completionTimeFilter} onValueChange={setCompletionTimeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tiempo completado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tiempos</SelectItem>
                <SelectItem value="fast">Rápido (&lt; 1 día)</SelectItem>
                <SelectItem value="normal">Normal (1-3 días)</SelectItem>
                <SelectItem value="slow">Lento (&gt; 3 días)</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include-paused"
                checked={includePaused}
                onChange={(e) => setIncludePaused(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="include-paused" className="text-sm font-medium">
                Incluir pausados
              </label>
            </div>
          </div>

          {/* Controles de ordenamiento */}
          <div className="flex flex-wrap gap-4 mt-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Ordenar por:</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Fecha creación</SelectItem>
                  <SelectItem value="completedAt">Fecha finalización</SelectItem>
                  <SelectItem value="folio">Folio</SelectItem>
                  <SelectItem value="clienteHotel">Cliente</SelectItem>
                  <SelectItem value="totalPiezas">Cantidad piezas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Orden:</label>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descendente</SelectItem>
                  <SelectItem value="asc">Ascendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resumen de filtros activos */}
          <div className="flex flex-wrap gap-2 mt-4">
            {(searchTerm || statusFilter !== 'all' || areaFilter !== 'all' || dateFilter !== 'all' || sizeFilter !== 'all' || completionTimeFilter !== 'all' || includePaused) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Filtros activos:</span>
                {searchTerm && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Búsqueda: "{searchTerm.substring(0, 20)}{searchTerm.length > 20 ? '...' : ''}"
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchTerm('')} />
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setAreaFilter('all');
                    setDateFilter('all');
                    setSizeFilter('all');
                    setCompletionTimeFilter('all');
                    setIncludePaused(false);
                  }}
                  className="h-6 text-xs"
                >
                  Limpiar todo
                </Button>
              </div>
            )}
          </div>

          {/* Estadísticas de resultados */}
          <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Mostrando <span className="font-semibold text-gray-900 dark:text-white">{filteredOrders.length}</span> de <span className="font-semibold text-gray-900 dark:text-white">{orders.length}</span> pedidos
              {filteredOrders.length !== orders.length && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  ({Math.round((filteredOrders.length / orders.length) * 100)}% del total)
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Historial de Pedidos ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-800">{order.folio}</h3>
                          <p className="text-sm text-gray-600">{order.clienteHotel}</p>
                        </div>
                        <Badge className={getStatusBadgeColor(order.status)}>
                          {order.status === 'completed' ? 'Finalizado' : 'En Proceso'}
                        </Badge>
                        <Badge className={getAreaBadgeColor(order.currentArea)}>
                          {getAreaDisplayName(order.currentArea)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Modelo:</span> {order.modelo}
                        </div>
                        <div>
                          <span className="font-medium">Tipo:</span> {order.tipoPrenda}
                        </div>
                        <div>
                          <span className="font-medium">Color:</span> {order.color}
                        </div>
                        <div>
                          <span className="font-medium">Tela:</span> {order.tela}
                        </div>
                        <div>
                          <span className="font-medium">Piezas:</span> {order.totalPiezas}
                        </div>
                        <div>
                          <span className="font-medium">No. Solicitud:</span> {order.noSolicitud}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-gray-500">Creado</p>
                      <p className="text-sm font-medium">{formatDate(order.createdAt)}</p>
                      {order.completedAt && (
                        <>
                          <p className="text-sm text-gray-500 mt-2">Finalizado</p>
                          <p className="text-sm font-medium">{formatDate(order.completedAt)}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setShowDetails(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalles
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setShowHistory(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Historial
                      </Button>
                      {(user?.area === 'admin' || user?.area === 'envios') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteOrder(order.id)}
                          className="text-red-600 hover:text-red-700"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                </div>
              ))}

              {filteredOrders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No se encontraron pedidos con los filtros aplicados</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Modals */}
      {showHistory && selectedOrderId && (
        <OrderHistoryModal
          open={showHistory}
          onClose={() => setShowHistory(false)}
          orderId={selectedOrderId}
        />
      )}

      {showDetails && selectedOrderId && (
        <OrderDetailsModal
          open={showDetails}
          onClose={() => setShowDetails(false)}
          orderId={selectedOrderId}
        />
      )}
    </Layout>
  );
}